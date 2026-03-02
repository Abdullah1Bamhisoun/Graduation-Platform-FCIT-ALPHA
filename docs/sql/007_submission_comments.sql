-- ============================================================
-- Create submission_comments table for student-supervisor discussion
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Ensure submission_feedback table exists with proper structure
CREATE TABLE IF NOT EXISTS submission_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  overall_comment TEXT NOT NULL DEFAULT '',
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_score   NUMERIC(6,2) NOT NULL DEFAULT 0,
  max_score     NUMERIC(6,2) NOT NULL DEFAULT 0,
  UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback(submission_id);

-- Discussion comments table
CREATE TABLE IF NOT EXISTS submission_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_role   TEXT NOT NULL CHECK (author_role IN ('student', 'supervisor')),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_comments_submission ON submission_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_created    ON submission_comments(created_at);

-- Enable RLS (access control is enforced in the backend API layer)
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write (backend handles per-user access control)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'submission_comments' AND policyname = 'authenticated_select'
  ) THEN
    CREATE POLICY authenticated_select ON submission_comments
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'submission_comments' AND policyname = 'authenticated_insert'
  ) THEN
    CREATE POLICY authenticated_insert ON submission_comments
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
