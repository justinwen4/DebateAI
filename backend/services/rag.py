import json
import os
from pathlib import Path

import chromadb

COLLECTION_NAME = "debate_analytics"
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "dataset.jsonl")

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_collection() -> chromadb.Collection:
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=DB_DIR)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def seed_from_dataset() -> int:
    """Load dataset.jsonl into Chroma if not already populated."""
    col = _get_collection()
    if col.count() > 0:
        return col.count()

    path = Path(DATASET_PATH)
    if not path.exists():
        return 0

    ids, documents, metadatas = [], [], []
    for i, line in enumerate(path.read_text().strip().splitlines()):
        row = json.loads(line)
        ids.append(f"doc_{i}")
        documents.append(row["output"])
        metadatas.append({"input": row["input"]})

    if ids:
        col.add(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def retrieve(query: str, n_results: int = 3) -> str:
    """Return top-k debate analytics relevant to the query."""
    col = _get_collection()
    if col.count() == 0:
        return ""

    results = col.query(query_texts=[query], n_results=min(n_results, col.count()))
    docs = results.get("documents", [[]])[0]
    return "\n\n---\n\n".join(docs)
