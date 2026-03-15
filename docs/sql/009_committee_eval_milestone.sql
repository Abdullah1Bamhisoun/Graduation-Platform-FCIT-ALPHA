-- Migration 009: Committee Evaluation Milestone Linking
-- Adds:
--   1. include_in_committee_eval column to milestones
--   2. comment column to coordinator_assessments
--   3. comment column on supervisor_assessments
--   4. submission_status column on committee_evaluations (for filtering)
--   5. committee_milestone_feedback table (per-milestone feedback from committee)

-- ── 1. Include in Committee Eval flag on milestones ─────────────────────────
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS include_in_committee_eval BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN milestones.include_in_committee_eval IS
  'When true, this milestone appears in the Committee Evaluation page so committee members can review the group submission and leave feedback.';

-- ── 2. Comment column on coordinator_assessments ─────────────────────────────
ALTER TABLE coordinator_assessments
  ADD COLUMN IF NOT EXISTS comment TEXT;

COMMENT ON COLUMN coordinator_assessments.comment IS
  'Optional free-text comment from the coordinator for this group evaluation.';

-- ── 3. Comment column on supervisor_assessments ──────────────────────────────
ALTER TABLE supervisor_assessments
  ADD COLUMN IF NOT EXISTS comment TEXT;

-- ── 4. submission_status on committee_evaluations ────────────────────────────
ALTER TABLE committee_evaluations
  ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'submitted';

-- ── 5. Per-milestone feedback from committee members ─────────────────────────
CREATE TABLE IF NOT EXISTS committee_milestone_feedback (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  milestone_id   UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  evaluator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment        TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, course_id, milestone_id, evaluator_id)
);

-- RLS: evaluators can write their own feedback; students/supervisors can read
ALTER TABLE committee_milestone_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Committee can upsert own milestone feedback"
  ON committee_milestone_feedback FOR ALL
  USING  (auth.uid() = evaluator_id)
  WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Students and supervisors can read milestone feedback"
  ON committee_milestone_feedback FOR SELECT
  USING (true);
