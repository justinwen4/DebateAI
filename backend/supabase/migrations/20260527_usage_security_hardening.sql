-- Monthly generation usage for premium (Sonnet) tier tracking
CREATE TABLE IF NOT EXISTS public.user_generation_usage (
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    generation_count INT NOT NULL DEFAULT 0 CHECK (generation_count >= 0),
    PRIMARY KEY (user_id, month_start)
);

ALTER TABLE public.user_generation_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.increment_monthly_generations(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := date_trunc('month', NOW())::DATE;
    v_count INT;
BEGIN
    INSERT INTO public.user_generation_usage (user_id, month_start, generation_count)
    VALUES (p_user_id, v_month, 1)
    ON CONFLICT (user_id, month_start)
    DO UPDATE
    SET generation_count = public.user_generation_usage.generation_count + 1
    RETURNING generation_count INTO v_count;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_monthly_generations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_monthly_generations(UUID) TO service_role;

-- Lock down RAG similarity search to service role only
REVOKE EXECUTE ON FUNCTION public.match_rag_embeddings FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_rag_embeddings TO service_role;

-- Attribute feedback and training requests to authenticated users
ALTER TABLE public.feedback
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback (user_id);

ALTER TABLE public.training_requests
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_requests_user_id_idx ON public.training_requests (user_id);
