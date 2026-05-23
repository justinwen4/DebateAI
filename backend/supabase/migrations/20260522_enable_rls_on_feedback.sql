-- feedback is written/read only via backend/ML using the service role key.
-- Enable RLS with no anon/authenticated policies so PostgREST blocks public access.
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
