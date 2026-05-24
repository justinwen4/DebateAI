-- Product analytics: private schema + service-role-only RPC wrappers for the admin API.

CREATE SCHEMA IF NOT EXISTS analytics;

REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
GRANT USAGE ON SCHEMA analytics TO postgres, service_role;

CREATE OR REPLACE VIEW analytics.daily_metrics
WITH (security_invoker = true) AS
SELECT
  (date_trunc('day', m.created_at AT TIME ZONE 'UTC'))::date AS day,
  COUNT(*) FILTER (WHERE m.role = 'user') AS prompts,
  COUNT(*) FILTER (WHERE m.role = 'assistant') AS assistant_messages,
  COUNT(DISTINCT c.user_id) FILTER (WHERE m.role = 'user') AS active_users,
  COUNT(DISTINCT c.id) AS conversations_touched
FROM public.messages m
JOIN public.conversations c ON c.id = m.conversation_id
GROUP BY 1;

GRANT SELECT ON analytics.daily_metrics TO service_role;

CREATE OR REPLACE FUNCTION analytics.product_metrics_summary(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, analytics
AS $$
DECLARE
  result json;
  since timestamptz := NOW() - make_interval(days => p_days);
BEGIN
  SELECT json_build_object(
    'period_days', p_days,
    'since', since,
    'computed_at', NOW(),
    'active_users', (
      SELECT COUNT(DISTINCT c.user_id)
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.role = 'user' AND m.created_at >= since
    ),
    'total_prompts', (
      SELECT COUNT(*)
      FROM messages
      WHERE role = 'user' AND created_at >= since
    ),
    'total_assistant_messages', (
      SELECT COUNT(*)
      FROM messages
      WHERE role = 'assistant' AND created_at >= since
    ),
    'conversations_started', (
      SELECT COUNT(*)
      FROM conversations
      WHERE created_at >= since
    ),
    'conversations_with_activity', (
      SELECT COUNT(DISTINCT c.id)
      FROM conversations c
      JOIN messages m ON m.conversation_id = c.id
      WHERE m.created_at >= since
    ),
    'avg_prompts_per_active_user', (
      SELECT ROUND(
        COUNT(*)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0),
        2
      )
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.role = 'user' AND m.created_at >= since
    ),
    'signups', (
      SELECT COUNT(*)
      FROM auth.users
      WHERE created_at >= since
    ),
    'feedback_count', (
      SELECT COUNT(*)
      FROM feedback
      WHERE created_at >= since
    ),
    'feedback_avg_rating', (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM feedback
      WHERE created_at >= since
    ),
    'feedback_low_rating_count', (
      SELECT COUNT(*)
      FROM feedback
      WHERE created_at >= since AND rating <= 2
    )
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION analytics.product_metrics_daily(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  prompts bigint,
  assistant_messages bigint,
  active_users bigint,
  conversations_touched bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, analytics
AS $$
  SELECT
    d.day,
    d.prompts,
    d.assistant_messages,
    d.active_users,
    d.conversations_touched
  FROM analytics.daily_metrics d
  WHERE d.day >= (CURRENT_DATE - p_days)
  ORDER BY d.day ASC;
$$;

REVOKE ALL ON FUNCTION analytics.product_metrics_summary(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION analytics.product_metrics_daily(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION analytics.product_metrics_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION analytics.product_metrics_daily(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_product_metrics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = analytics, public, auth
AS $$
  SELECT analytics.product_metrics_summary(p_days);
$$;

CREATE OR REPLACE FUNCTION public.admin_product_metrics_daily(p_days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  prompts bigint,
  assistant_messages bigint,
  active_users bigint,
  conversations_touched bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = analytics, public, auth
AS $$
  SELECT * FROM analytics.product_metrics_daily(p_days);
$$;

REVOKE ALL ON FUNCTION public.admin_product_metrics(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_product_metrics_daily(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_product_metrics(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_product_metrics_daily(integer) TO service_role;
