-- Add curation_eligible flag to feedback rows so only first-turn prompts
-- are ingested into training curation pipelines.
ALTER TABLE feedback
ADD COLUMN IF NOT EXISTS curation_eligible BOOLEAN NOT NULL DEFAULT FALSE;

-- Helpful index for curation jobs filtering by eligibility + rating.
CREATE INDEX IF NOT EXISTS feedback_curation_rating_idx
ON feedback (curation_eligible, rating);
