-- Store original uploaded training files in Supabase Storage.
ALTER TABLE public.training_requests
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-files',
  'training-files',
  false,
  524288,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "service role manage training files"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'training-files')
  WITH CHECK (bucket_id = 'training-files');
