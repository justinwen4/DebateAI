-- Public contact form submissions from the /contact page.
-- Written from the frontend using the anon key; readable only via service role / dashboard.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'bug', 'feature')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow anon insert"
  ON contact_submissions FOR INSERT
  TO anon
  WITH CHECK (true);
