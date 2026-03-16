-- Migration 010: Group Files Table and Comment Visibility Scope
--
-- Adds:
--   1. group_files table — role-targeted file uploads per group with versioning
--   2. visibility_scope column on submission_comments — controls who can see each comment

-- ── 1. Group Files ────────────────────────────────────────────────────────────
-- Stores files uploaded in the context of a specific group (committee files,
-- supervisor feedback files, student uploads, etc.).  Visibility is enforced
-- by the API layer based on uploader_role and target_role.
CREATE TABLE IF NOT EXISTS group_files (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  course_id           UUID REFERENCES courses(id) ON DELETE SET NULL,
  uploaded_by         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Role of the uploader at the time of upload
  uploader_role       TEXT NOT NULL
    CHECK (uploader_role IN ('student', 'supervisor', 'committee', 'coordinator')),
  file_name           TEXT NOT NULL,
  file_size           BIGINT,
  file_path           TEXT NOT NULL,
  -- Who this file is intended for (drives visibility logic)
  target_role         TEXT
    CHECK (target_role IN ('supervisor', 'committee', 'coordinator', 'all')),
  -- Explicit flag: file was submitted to committee (mirrors target_role = 'committee')
  submit_to_committee BOOLEAN NOT NULL DEFAULT FALSE,
  -- Versioning
  version_number      INTEGER NOT NULL DEFAULT 1,
  parent_file_id      UUID REFERENCES group_files(id) ON DELETE SET NULL,
  -- Course identifier for cross-course reference (e.g. 'CPIS-498', 'CPIS-499')
  course_number       TEXT,
  notes               TEXT,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (actual visibility enforced at API layer via supabaseAdmin)
ALTER TABLE group_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read group files"
  ON group_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert group files"
  ON group_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Uploader can delete own group files"
  ON group_files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Index for fast per-group lookups
CREATE INDEX IF NOT EXISTS idx_group_files_group_id
  ON group_files (group_id);

CREATE INDEX IF NOT EXISTS idx_group_files_committee
  ON group_files (group_id, submit_to_committee)
  WHERE submit_to_committee = TRUE;

-- ── 2. Comment Visibility Scope ───────────────────────────────────────────────
-- 'supervisor_only'      → visible to supervisor + students of the same group only
--                          (committee members and coordinator cannot see these)
-- 'committee_and_above'  → visible to committee members, coordinator, supervisor, and students
-- NULL / 'all'           → visible to all users with group access (default)
ALTER TABLE submission_comments
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT
    CHECK (visibility_scope IN ('supervisor_only', 'committee_and_above', 'all'))
    DEFAULT 'all';

-- Back-fill existing supervisor comments as 'supervisor_only'
UPDATE submission_comments
  SET visibility_scope = 'supervisor_only'
  WHERE author_role = 'supervisor'
    AND visibility_scope IS NULL;

COMMENT ON COLUMN submission_comments.visibility_scope IS
  'supervisor_only: supervisor + students only. committee_and_above: committee + coordinator + supervisor + students. all: everyone with group access.';
