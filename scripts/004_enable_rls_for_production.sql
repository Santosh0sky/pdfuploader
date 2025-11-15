-- =====================================================
-- RE-ENABLE RLS FOR PRODUCTION (WITH AUTHENTICATION)
-- =====================================================
-- Run this script when you want to re-enable authentication
-- and secure your data with proper RLS policies.
-- =====================================================

-- Re-enable RLS on tables
ALTER TABLE public.pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop permissive test policies for storage
DROP POLICY IF EXISTS "Allow public upload to pdfs bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from pdfs bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from pdfs bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update in pdfs bucket" ON storage.objects;

-- Recreate secure storage policies
CREATE POLICY "Users can upload PDFs to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Make the pdfs bucket private again
UPDATE storage.buckets
SET public = false
WHERE id = 'pdfs';
