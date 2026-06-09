-- Cost controls: durable per-user daily quotas + refundable monthly reservations.
--
-- Replaces the in-process rate limiter (backend/services/limits.py) which
-- reset on every deploy and was not shared across workers.

-- Per-user, per-action daily counters (UTC day buckets)
CREATE TABLE IF NOT EXISTS public.user_daily_usage (
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    day DATE NOT NULL,
    request_count INT NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, action, day)
);

ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;

-- Atomically consume one unit of daily quota. Returns TRUE if the request is
-- within the limit (and was counted), FALSE if the limit is already reached.
-- The conditional UPDATE makes concurrent requests race-free: only rows with
-- request_count < p_max_count are incremented.
CREATE OR REPLACE FUNCTION public.consume_daily_quota(
    p_user_id UUID,
    p_action TEXT,
    p_max_count INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day DATE := (NOW() AT TIME ZONE 'utc')::DATE;
    v_count INT;
BEGIN
    INSERT INTO public.user_daily_usage (user_id, action, day, request_count)
    VALUES (p_user_id, p_action, v_day, 1)
    ON CONFLICT (user_id, action, day)
    DO UPDATE
    SET request_count = user_daily_usage.request_count + 1
    WHERE user_daily_usage.request_count < p_max_count
    RETURNING request_count INTO v_count;

    RETURN v_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_quota(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_daily_quota(UUID, TEXT, INT) TO service_role;

-- Refund one monthly generation (floor at 0). Used when a generation fails
-- server-side after the reservation was taken.
CREATE OR REPLACE FUNCTION public.refund_monthly_generation(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := date_trunc('month', NOW())::DATE;
    v_count INT;
BEGIN
    UPDATE public.user_generation_usage
    SET generation_count = GREATEST(generation_count - 1, 0)
    WHERE user_id = p_user_id AND month_start = v_month
    RETURNING generation_count INTO v_count;

    RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_monthly_generation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_monthly_generation(UUID) TO service_role;

-- Housekeeping: old day buckets are tiny but useless after the window passes.
-- (Optional cleanup; safe to run anytime.)
-- DELETE FROM public.user_daily_usage WHERE day < (NOW() AT TIME ZONE 'utc')::DATE - 7;
