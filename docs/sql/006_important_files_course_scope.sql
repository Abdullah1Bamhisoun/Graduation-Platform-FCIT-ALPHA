-- ============================================================
-- Create important_files table with course_id scope
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS important_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  size         TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'pdf',
  file_url     TEXT,
  course_id    UUID REFERENCES courses(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_important_files_course_id ON important_files(course_id);
CREATE INDEX IF NOT EXISTS idx_important_files_uploaded_at ON important_files(uploaded_at DESC);

-- If the table already existed without course_id, add the column safely
ALTER TABLE important_files
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
