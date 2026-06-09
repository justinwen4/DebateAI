-- Base feedback table. Historically created via the Supabase dashboard before
-- migrations were introduced, so a fresh `supabase db reset` had no CREATE for
-- it and every later feedback migration (curation_eligible, RLS, user_id)
-- failed. This recreates the original base table idempotently; the columns
-- added later are intentionally left to their own migrations:
--   20260513_add_curation_eligible_to_feedback.sql  -> curation_eligible
--   20260522_enable_rls_on_feedback.sql             -> RLS
--   20260527_usage_security_hardening.sql           -> user_id
-- IF NOT EXISTS keeps this a no-op on the live DB, where the table already exists.
CREATE TABLE IF NOT EXISTS public.feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prompt TEXT NOT NULL,
    bad_output TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
