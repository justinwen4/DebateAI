import os
from unittest.mock import MagicMock

import pytest

# Minimal env so service modules can import without a real Supabase project.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon-key")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")


@pytest.fixture
def supabase_client() -> MagicMock:
    client = MagicMock()
    rpc = MagicMock()
    rpc.execute.return_value = MagicMock(data=True)
    client.rpc.return_value = rpc
    return client
