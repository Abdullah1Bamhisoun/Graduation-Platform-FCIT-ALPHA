-- ============================================================
-- Link milestones to a grading criterion from the Grade Scheme Editor
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add grading_criterion_id column to milestones
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS grading_criterion_id UUID
    REFERENCES grading_rubric_criteria(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_milestones_grading_criterion
  ON milestones(grading_criterion_id)
  WHERE grading_criterion_id IS NOT NULL;
