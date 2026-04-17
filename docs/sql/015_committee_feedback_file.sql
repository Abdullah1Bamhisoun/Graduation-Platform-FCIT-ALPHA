-- Migration 015: Committee Evaluation Feedback File
-- Adds comment_file_url, comment_file_name, and uploaded_at columns to
-- committee_evaluations so supervisors can attach a feedback file when
-- submitting a committee evaluation.

ALTER TABLE committee_evaluations
  ADD COLUMN IF NOT EXISTS comment_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS comment_file_name TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at       TIMESTAMPTZ;

-- Also add a general comment column if not already present
-- (older schemas may be missing it)
ALTER TABLE committee_evaluations
  ADD COLUMN IF NOT EXISTS comment TEXT;
