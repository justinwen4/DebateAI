-- User-submitted training topic requests from the landing page.
-- Written only via backend using the service role key.
CREATE TABLE IF NOT EXISTS training_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,
  file_name TEXT,
  file_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE training_requests ENABLE ROW LEVEL SECURITY;
