import hashlib
import json
import os
from pathlib import Path
from typing import Literal

import chromadb

COLLECTION_NAME = "debate_analytics"
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "dataset.jsonl")
HASH_FILE = os.path.join(DB_DIR, ".dataset_hash")

Category = Literal["Theory", "Philosophy", "Kritik"]
CATEGORIES: frozenset[str] = frozenset({"Theory", "Philosophy", "Kritik"})

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


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


def seed_from_dataset() -> int:
    """Load dataset.jsonl into Chroma, reseeding if the file changed."""
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
        cat = row.get("category", "")
        if cat not in CATEGORIES:
            raise ValueError(f"Row {i} has invalid category {cat!r}")
        ids.append(f"doc_{i}")
        documents.append(row["input"])
        metadatas.append({"output": row["output"], "category": cat})

    if ids:
        col.add(ids=ids, documents=documents, metadatas=metadatas)

    _save_hash(path)
    return len(ids)


def retrieve(query: str, category: Category, n_results: int = 3) -> str:
    """Return top-k debate analytics relevant to the query within a category."""
    if category not in CATEGORIES:
        raise ValueError(f"Invalid category {category!r}")

    col = _get_collection()
    if col.count() == 0:
        return ""

    results = col.query(
        query_texts=[query],
        n_results=min(n_results, col.count()),
        where={"category": category},
        include=["metadatas"],
    )
    metas = results.get("metadatas", [[]])[0]
    if not metas:
        return ""
    outputs = [m["output"] for m in metas]
    return "\n\n---\n\n".join(outputs)
