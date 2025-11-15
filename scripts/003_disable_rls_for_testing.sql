-- =====================================================
-- DISABLE RLS FOR TESTING (NO AUTHENTICATION)
-- =====================================================
-- WARNING: This makes your data publicly accessible!
-- Only use for development/testing purposes.
-- Re-enable RLS before deploying to production.
-- =====================================================

-- Disable RLS on tables
ALTER TABLE public.pdfs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies for storage
DROP POLICY IF EXISTS "Users can upload PDFs to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own PDFs" ON storage.objects;

-- Create permissive policies for storage (allow all operations)
CREATE POLICY "Allow public upload to pdfs bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdfs');

CREATE POLICY "Allow public read from pdfs bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdfs');

CREATE POLICY "Allow public delete from pdfs bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdfs');

CREATE POLICY "Allow public update in pdfs bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pdfs');

-- Make the pdfs bucket public for easier access
UPDATE storage.buckets
SET public = true
WHERE id = 'pdfs';
