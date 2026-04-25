-- ─────────────────────────────────────────────────────────────────────────────
-- 010_meetings_student_creator.sql
-- Extends the creator_role CHECK constraint to allow students to create meetings.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE meetings
  DROP CONSTRAINT IF EXISTS meetings_creator_role_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_creator_role_check
    CHECK (creator_role IN ('coordinator', 'supervisor', 'student'));
