-- ============================================================
-- Storage RLS Policies + Table Policies for Student Uploads
-- Run this in: Supabase Dashboard → SQL Editor
--
-- The "File Upload" bucket already exists.
-- This script only creates the missing RLS policies.
-- ============================================================

-- ─── Storage: INSERT — students upload only to their own folder ───────────────
-- Path written by uploadSubmissionFile():
--   submissions/{studentId}/{milestoneId}/{timestamp}-{filename}
-- Postgres arrays are 1-indexed; storage.foldername splits on '/'.

DROP POLICY IF EXISTS "Students can upload to own folder" ON storage.objects;
CREATE POLICY "Students can upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'File Upload'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ─── Storage: SELECT — any authenticated user can read/download files ─────────
-- Supervisors, coordinators, and admins all need to download student submissions.

DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
CREATE POLICY "Authenticated users can read files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'File Upload');

-- ─── Storage: INSERT — admins upload important files ─────────────────────────
-- Path written by uploadImportantFile():
--   important-files/{timestamp}-{filename}

DROP POLICY IF EXISTS "Admins can upload important files" ON storage.objects;
CREATE POLICY "Admins can upload important files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'File Upload'
    AND (storage.foldername(name))[1] = 'important-files'
  );

-- ─── Storage: DELETE — students can remove only their own files ───────────────

DROP POLICY IF EXISTS "Students can delete own files" ON storage.objects;
CREATE POLICY "Students can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'File Upload'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ─── Storage: DELETE — admins can remove important files ─────────────────────

DROP POLICY IF EXISTS "Admins can delete important files" ON storage.objects;
CREATE POLICY "Admins can delete important files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'File Upload'
    AND (storage.foldername(name))[1] = 'important-files'
  );

-- ─── submissions: INSERT — students create their own submission rows ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submissions'
      AND policyname = 'Students can create own submissions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can create own submissions"
        ON public.submissions
        FOR INSERT
        TO authenticated
        WITH CHECK (student_id = auth.uid());
    $policy$;
  END IF;
END;
$$;

-- ─── submissions: UPDATE — students bump current_version on resubmit ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submissions'
      AND policyname = 'Students can update own submission version'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can update own submission version"
        ON public.submissions
        FOR UPDATE
        TO authenticated
        USING (student_id = auth.uid())
        WITH CHECK (student_id = auth.uid());
    $policy$;
  END IF;
END;
$$;

-- ─── submission_versions: INSERT — students add new version rows ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submission_versions'
      AND policyname = 'Students can add submission versions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Students can add submission versions"
        ON public.submission_versions
        FOR INSERT
        TO authenticated
        WITH CHECK (
          submission_id IN (
            SELECT id FROM public.submissions WHERE student_id = auth.uid()
          )
        );
    $policy$;
  END IF;
END;
$$;
