import asyncio
import hashlib
import json
import logging
import os
import threading
from pathlib import Path

import chromadb

logger = logging.getLogger(__name__)
_reseed_lock = threading.Lock()

COLLECTION_NAME = "debate_analytics"
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "dataset.tutor.jsonl")
HASH_FILE = os.path.join(DB_DIR, ".dataset_hash")

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None
_last_mtime: float = 0.0


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=DB_DIR)
    return _client


def _get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        _collection = _get_client().get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def _needs_reseed(path: Path) -> bool:
    current_hash = _file_hash(path)
    hash_path = Path(HASH_FILE)
    if hash_path.exists() and hash_path.read_text().strip() == current_hash:
        return False
    return True


def _save_hash(path: Path) -> None:
    os.makedirs(DB_DIR, exist_ok=True)
    Path(HASH_FILE).write_text(_file_hash(path))


def _seed_from_dataset_unlocked() -> int:
    """Load dataset.tutor.jsonl into Chroma. Caller must hold _reseed_lock."""
    path = Path(DATASET_PATH)
    if not path.exists():
        return 0

    if not _needs_reseed(path):
        return _get_collection().count()

    global _collection
    client = _get_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    _collection = None
    col = _get_collection()

    ids, documents, metadatas = [], [], []
    for i, line in enumerate(path.read_text().strip().splitlines()):
        row = json.loads(line)
        ids.append(f"doc_{i}")
        documents.append(row["input"])
        metadatas.append({"input": row["input"], "output": row["output"]})

    if ids:
        col.add(ids=ids, documents=documents, metadatas=metadatas)

    _save_hash(path)
    return len(ids)


def seed_from_dataset() -> int:
    """Load dataset.tutor.jsonl into Chroma, reseeding if the file changed."""
    with _reseed_lock:
        return _seed_from_dataset_unlocked()


def _reseed_if_changed() -> None:
    """Reseed Chroma if dataset.tutor.jsonl has been modified since last check."""
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


def _retrieve_sync(query: str, n_results: int = 3, distance_threshold: float = 0.4) -> str:
    """Return top-k debate analytics relevant to the query.

    Results whose cosine distance exceeds distance_threshold are dropped, so
    the number of returned examples may be fewer than n_results (including zero).
    """
    _reseed_if_changed()
    col = _get_collection()
    if col.count() == 0:
        return ""

    results = col.query(
        query_texts=[query],
        n_results=min(n_results, col.count()),
        include=["metadatas", "distances"],
    )
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    if not metas:
        return ""
    pairs = []
    for m, d in zip(metas, distances):
        status = "✓" if d <= distance_threshold else "✗"
        logger.info("[rag] %s dist=%.3f | %s", status, d, m['input'][:80])
        if d <= distance_threshold:
            pairs.append(f"Q: {m['input']}\nA: {m['output']}")
    logger.info("[rag] %d/%d results passed threshold %.2f", len(pairs), len(metas), distance_threshold)
    return "\n\n---\n\n".join(pairs)


async def retrieve(query: str, n_results: int = 3, distance_threshold: float = 0.4) -> str:
    """Return top-k debate analytics relevant to the query (non-blocking)."""
    return await asyncio.to_thread(_retrieve_sync, query, n_results, distance_threshold)
