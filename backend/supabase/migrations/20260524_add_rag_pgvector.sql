-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- RAG embeddings: stores OpenAI text-embedding-3-small vectors (1536 dims)
CREATE TABLE IF NOT EXISTS public.rag_embeddings (
    id TEXT PRIMARY KEY,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    embedding extensions.vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metadata: tracks dataset hash to avoid redundant re-seeding
CREATE TABLE IF NOT EXISTS public.rag_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat cosine index for fast approximate nearest-neighbour search
-- lists=50 is appropriate for ~700 rows; raise to 100+ if corpus grows beyond 5k rows
CREATE INDEX IF NOT EXISTS rag_embeddings_embedding_idx
    ON public.rag_embeddings
    USING ivfflat (embedding extensions.vector_cosine_ops)
    WITH (lists = 50);

-- RLS: tables are server-only; service role bypasses RLS automatically.
-- No SELECT/INSERT policies are granted to anon or authenticated roles.
ALTER TABLE public.rag_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_metadata ENABLE ROW LEVEL SECURITY;

-- Similarity search function used by the backend RAG service
CREATE OR REPLACE FUNCTION public.match_rag_embeddings(
    query_embedding extensions.vector(1536),
    match_count INT DEFAULT 3,
    match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
    id TEXT,
    input TEXT,
    output TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        id,
        input,
        output,
        1 - (embedding <=> query_embedding) AS similarity
    FROM public.rag_embeddings
    WHERE 1 - (embedding <=> query_embedding) >= match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;
