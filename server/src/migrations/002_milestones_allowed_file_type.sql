-- Migration: Add allowed_file_type column to milestones
-- Allows restricting file upload format per milestone (e.g. 'pdf', 'docx', 'pptx').
-- NULL / empty string means any format is accepted.

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS allowed_file_type TEXT DEFAULT NULL;
