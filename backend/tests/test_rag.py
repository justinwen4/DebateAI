import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from services import rag


def _make_dataset(tmp_path: Path, rows: list[dict] | None = None) -> Path:
    path = tmp_path / "dataset.tutor.jsonl"
    rows = rows or [{"input": "Q1", "output": "A1"}]
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    return path


def _mock_metadata_query(supabase: MagicMock, stored_value: str | None) -> None:
    table = MagicMock()
    chain = table.select.return_value.eq.return_value.maybe_single.return_value
    if stored_value is None:
        chain.execute.return_value = MagicMock(data=None)
    else:
        chain.execute.return_value = MagicMock(data={"value": stored_value})
    supabase.table.return_value = table


def test_needs_reseed_true_when_metadata_row_missing(tmp_path):
    path = _make_dataset(tmp_path)
    supabase = MagicMock()
    _mock_metadata_query(supabase, stored_value=None)

    with patch.object(rag, "_get_supabase", return_value=supabase):
        assert rag._needs_reseed(path) is True


def test_needs_reseed_false_when_hash_matches(tmp_path):
    path = _make_dataset(tmp_path)
    current_hash = rag._dataset_fingerprint(path)
    supabase = MagicMock()
    _mock_metadata_query(supabase, stored_value=current_hash)

    with patch.object(rag, "_get_supabase", return_value=supabase):
        assert rag._needs_reseed(path) is False


def test_seed_keeps_embeddings_on_metadata_read_error(tmp_path):
    path = _make_dataset(tmp_path)
    supabase = MagicMock()
    table = MagicMock()
    table.select.return_value.eq.return_value.maybe_single.return_value.execute.side_effect = (
        RuntimeError("transient db error")
    )
    supabase.table.return_value = table

    with (
        patch.object(rag, "DATASET_PATH", str(path)),
        patch.object(rag, "_get_supabase", return_value=supabase),
        patch.object(rag, "_embedding_count", return_value=703) as count_mock,
        patch.object(rag, "_embed_batch") as embed_mock,
    ):
        result = rag._seed_from_dataset_unlocked()

    assert result == 703
    embed_mock.assert_not_called()
    count_mock.assert_called_once()


def test_seed_skips_when_hash_unchanged(tmp_path):
    path = _make_dataset(tmp_path)
    current_hash = rag._dataset_fingerprint(path)
    supabase = MagicMock()
    _mock_metadata_query(supabase, stored_value=current_hash)

    with (
        patch.object(rag, "DATASET_PATH", str(path)),
        patch.object(rag, "_get_supabase", return_value=supabase),
        patch.object(rag, "_embedding_count", return_value=42),
        patch.object(rag, "_embed_batch") as embed_mock,
    ):
        result = rag._seed_from_dataset_unlocked()

    assert result == 42
    embed_mock.assert_not_called()


def test_seed_embeds_before_touching_store_on_hash_change(tmp_path):
    path = _make_dataset(tmp_path, [{"input": "Q1", "output": "A1"}, {"input": "Q2", "output": "A2"}])
    supabase = MagicMock()
    _mock_metadata_query(supabase, stored_value=None)

    embeddings_table = MagicMock()
    embeddings_table.select.return_value.execute.return_value = MagicMock(
        data=[{"id": "doc_0"}, {"id": "doc_stale"}]
    )
    embeddings_table.upsert.return_value.execute.return_value = MagicMock()
    embeddings_table.delete.return_value.in_.return_value.execute.return_value = MagicMock()

    metadata_table = MagicMock()
    metadata_table.upsert.return_value.execute.return_value = MagicMock()

    def table_router(name: str) -> MagicMock:
        if name == "rag_embeddings":
            return embeddings_table
        if name == "rag_metadata":
            return metadata_table
        raise AssertionError(f"unexpected table {name}")

    supabase.table.side_effect = table_router

    call_order: list[str] = []

    def track_embed(texts: list[str]) -> list[list[float]]:
        call_order.append("embed")
        return [[0.1, 0.2] for _ in texts]

    def track_upsert(*args, **kwargs):
        call_order.append("upsert")
        return embeddings_table.upsert.return_value

    embeddings_table.upsert.side_effect = track_upsert

    with (
        patch.object(rag, "DATASET_PATH", str(path)),
        patch.object(rag, "_get_supabase", return_value=supabase),
        patch.object(rag, "_embed_batch", side_effect=track_embed),
    ):
        result = rag._seed_from_dataset_unlocked()

    assert result == 2
    assert call_order.index("embed") < call_order.index("upsert")
    embeddings_table.delete.assert_called()
