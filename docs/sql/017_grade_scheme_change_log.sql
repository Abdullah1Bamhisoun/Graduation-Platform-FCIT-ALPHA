-- ─────────────────────────────────────────────────────────────────────────────
-- Grade Scheme Change Log
-- Tracks every coordinator/admin edit to grading components, rubric criteria,
-- and student outcomes so auditors can see who changed what and when.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grade_scheme_change_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  changed_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- What kind of change occurred
  change_type  TEXT NOT NULL CHECK (change_type IN (
    'component_updated',
    'criterion_created',
    'criterion_updated',
    'criterion_deleted',
    'outcome_created',
    'outcome_updated',
    'outcome_deleted'
  )),

  -- Which course this change belongs to
  course_type  TEXT CHECK (course_type IN ('498', '499')),

  -- Identifiers of the changed entity
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('component', 'criterion', 'student_outcome')),
  entity_id    UUID,
  entity_key   TEXT,   -- component_key / criterion_key / outcome code
  entity_name  TEXT,   -- human-readable label at time of change

  -- JSONB diff — store whatever fields were affected
  changes      JSONB
);

-- Index for the most common query: "show me the log sorted by time"
CREATE INDEX IF NOT EXISTS idx_grade_scheme_log_changed_at
  ON grade_scheme_change_log (changed_at DESC);

-- Index to look up all changes for a specific user
CREATE INDEX IF NOT EXISTS idx_grade_scheme_log_changed_by
  ON grade_scheme_change_log (changed_by);

-- Index to filter by course and entity type
CREATE INDEX IF NOT EXISTS idx_grade_scheme_log_course_entity
  ON grade_scheme_change_log (course_type, entity_type);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE grade_scheme_change_log ENABLE ROW LEVEL SECURITY;

-- Admins and coordinators can read all log entries
-- role is a PostgreSQL enum — cast to text before comparing to a string literal
CREATE POLICY "Admins and coordinators can read grade scheme log"
  ON grade_scheme_change_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('admin', 'coordinator')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'coordinator')
    )
  );

-- Any authenticated user can insert (the app always supplies changed_by)
CREATE POLICY "Authenticated users can insert grade scheme log"
  ON grade_scheme_change_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
