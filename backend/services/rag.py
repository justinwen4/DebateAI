import asyncio
import hashlib
import json
import logging
import os
import re
import threading
from pathlib import Path

from openai import OpenAI
from supabase import create_client, Client

logger = logging.getLogger(__name__)
_reseed_lock = threading.Lock()

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "dataset.tutor.jsonl")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBED_BATCH_SIZE = 100
EMBEDDING_CONTENT_VERSION = "input_output_v1"

_openai_client: OpenAI | None = None
_supabase_client: Client | None = None
_last_mtime: float = 0.0


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _openai_client


def _get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _supabase_client


def _embed_batch(texts: list[str]) -> list[list[float]]:
    response = _get_openai().embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def _embed(text: str) -> list[float]:
    return _embed_batch([text])[0]


def _file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def _dataset_fingerprint(path: Path) -> str:
    """Include embedding content changes in the reseed fingerprint."""
    return f"{EMBEDDING_CONTENT_VERSION}:{_file_hash(path)}"


def _embedding_text(row: dict) -> str:
    return f"Question: {row['input']}\n\nAnswer: {row['output']}"


def _needs_reseed(path: Path) -> bool:
    """Whether the stored dataset hash differs from the file's.

    Raises on a metadata read failure so the caller can keep the existing
    embeddings instead of treating a transient DB error as "reseed everything"
    (which would wipe the whole store). A missing metadata row (fresh DB) is a
    successful read returning no value, so it correctly signals a reseed.
    """
    current_hash = _dataset_fingerprint(path)
    result = (
        _get_supabase()
        .table("rag_metadata")
        .select("value")
        .eq("key", "dataset_hash")
        .maybe_single()
        .execute()
    )
    stored = result.data.get("value") if result and result.data else None
    return stored != current_hash


def _embedding_count() -> int:
    result = _get_supabase().table("rag_embeddings").select("id", count="exact").execute()
    return result.count or 0


def _seed_from_dataset_unlocked() -> int:
    """Load dataset.tutor.jsonl into Supabase pgvector. Caller must hold _reseed_lock."""
    path = Path(DATASET_PATH)
    if not path.exists():
        logger.info("[rag] dataset.tutor.jsonl not found — skipping seed, using existing Supabase data")
        return 0

    try:
        needs_reseed = _needs_reseed(path)
    except Exception:
        # Transient DB error reading the hash — never wipe good embeddings over it.
        logger.exception("[rag] reseed check failed; keeping existing Supabase embeddings")
        return _embedding_count()

    if not needs_reseed:
        count = _embedding_count()
        logger.info("[rag] dataset unchanged, %d embeddings already in Supabase", count)
        return count

    logger.info("[rag] seeding Supabase pgvector from %s", path)
    lines = path.read_text().strip().splitlines()
    rows_parsed = [json.loads(line) for line in lines]

    # Embed everything BEFORE touching the store: embedding calls hit OpenAI and
    # are the most likely thing to fail, so computing them first means a failure
    # leaves the existing embeddings intact rather than wiping them first.
    records = []
    for batch_start in range(0, len(rows_parsed), EMBED_BATCH_SIZE):
        batch = rows_parsed[batch_start : batch_start + EMBED_BATCH_SIZE]
        embeddings = _embed_batch([_embedding_text(r) for r in batch])
        records.extend(
            {
                "id": f"doc_{batch_start + i}",
                "input": r["input"],
                "output": r["output"],
                "embedding": emb,
            }
            for i, (r, emb) in enumerate(zip(batch, embeddings))
        )
        logger.info("[rag] embedded batch %d–%d", batch_start, batch_start + len(batch) - 1)

    sb = _get_supabase()
    sb.table("rag_embeddings").delete().neq("id", "").execute()
    for batch_start in range(0, len(records), EMBED_BATCH_SIZE):
        sb.table("rag_embeddings").upsert(records[batch_start : batch_start + EMBED_BATCH_SIZE]).execute()

    current_hash = _dataset_fingerprint(path)
    sb.table("rag_metadata").upsert({"key": "dataset_hash", "value": current_hash}).execute()
    logger.info("[rag] seeded %d embeddings total", len(records))
    return len(records)


def seed_from_dataset() -> int:
    """Load dataset.tutor.jsonl into Supabase pgvector, reseeding if the file changed."""
    with _reseed_lock:
        return _seed_from_dataset_unlocked()


def _reseed_if_changed() -> None:
    """Reseed if dataset.tutor.jsonl has been modified since last check."""
    global _last_mtime
    path = Path(DATASET_PATH)
    if not path.exists():
        return
    mtime = path.stat().st_mtime
    if mtime == _last_mtime:
        return
    with _reseed_lock:
        mtime = path.stat().st_mtime
        if mtime != _last_mtime:
            _seed_from_dataset_unlocked()
            _last_mtime = path.stat().st_mtime


def _parse_perm_axis(text: str, axis: str) -> str | None:
    """Parse textual/functionally intrinsic vs non-intrinsic from debate perm phrasing."""
    lowered = text.lower()
    if re.search(rf"{axis}\s+non[\s-]?intrinsic", lowered):
        return "non_intrinsic"
    if re.search(rf"{axis}\s+intrinsic", lowered):
        return "intrinsic"
    return None


def _parse_perm_slots(text: str) -> dict[str, str | None]:
    return {
        "textual": _parse_perm_axis(text, "textually"),
        "functional": _parse_perm_axis(text, "functionally"),
    }


def _perm_slot_filter_active(query: str, slots: dict[str, str | None]) -> bool:
    if not any(slots.values()):
        return False
    lowered = query.lower()
    if slots["textual"] and slots["functional"]:
        return True
    return "perm" in lowered or "permutation" in lowered


def _perm_slots_match(query_slots: dict[str, str | None], doc_input: str) -> bool:
    doc_slots = _parse_perm_slots(doc_input)
    for axis in ("textual", "functional"):
        expected = query_slots[axis]
        if expected is not None and doc_slots[axis] != expected:
            return False
    return True


def _filter_perm_slot_matches(query: str, rows: list[dict]) -> list[dict]:
    query_slots = _parse_perm_slots(query)
    if not _perm_slot_filter_active(query, query_slots):
        return rows

    matched = [row for row in rows if _perm_slots_match(query_slots, row["input"])]
    if matched:
        logger.info(
            "[rag] perm slot filter kept %d/%d (textual=%s, functional=%s)",
            len(matched),
            len(rows),
            query_slots["textual"],
            query_slots["functional"],
        )
        return matched

    logger.warning(
        "[rag] perm slot filter removed all candidates (textual=%s, functional=%s); falling back to top vector hit",
        query_slots["textual"],
        query_slots["functional"],
    )
    return rows[:1]


def _retrieve_sync(
    query: str,
    n_results: int = 3,
    distance_threshold: float = 0.4,
    slot_query: str | None = None,
) -> str:
    """Return top-k debate examples relevant to the query.

    distance_threshold is converted to cosine similarity (similarity = 1 - distance).
    slot_query: text used for perm slot parsing/filtering (defaults to query).
    """
    _reseed_if_changed()

    slot_text = slot_query if slot_query is not None else query
    similarity_threshold = 1.0 - distance_threshold
    query_embedding = _embed(query)
    query_slots = _parse_perm_slots(slot_text)
    fetch_count = max(n_results * 4, 10) if _perm_slot_filter_active(slot_text, query_slots) else n_results

    try:
        result = _get_supabase().rpc(
            "match_rag_embeddings",
            {
                "query_embedding": query_embedding,
                "match_count": fetch_count,
                "match_threshold": similarity_threshold,
            },
        ).execute()
    except Exception as exc:
        logger.warning("[rag] retrieval failed: %s", exc)
        return ""

    if not result.data:
        return ""

    rows = _filter_perm_slot_matches(slot_text, result.data)[:n_results]

    pairs = []
    for row in rows:
        sim = row["similarity"]
        logger.info("[rag] ✓ sim=%.3f | %s", sim, row["input"][:80])
        pairs.append(f"Q: {row['input']}\nA: {row['output']}")

    logger.info("[rag] %d/%d results passed threshold %.2f", len(pairs), n_results, similarity_threshold)
    return "\n\n---\n\n".join(pairs)


async def retrieve(
    query: str,
    n_results: int = 3,
    distance_threshold: float = 0.4,
    slot_query: str | None = None,
) -> str:
    """Return top-k debate examples relevant to the query (non-blocking)."""
    return await asyncio.to_thread(_retrieve_sync, query, n_results, distance_threshold, slot_query)
