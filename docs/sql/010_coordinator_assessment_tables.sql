-- ============================================================
-- Create / patch coordinator_assessments and coordinator_evaluations.
-- Uses ADD COLUMN IF NOT EXISTS so it is safe to run on both
-- fresh databases and databases where the tables already exist
-- with a partial schema.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── coordinator_assessments ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coordinator_assessments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  component_key     TEXT NOT NULL,
  normalized_score  NUMERIC(6,2) DEFAULT 0,
  max_score         NUMERIC(6,2) DEFAULT 0,
  submission_status TEXT DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if the table was created with an older schema
ALTER TABLE coordinator_assessments ADD COLUMN IF NOT EXISTS course_id      UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE coordinator_assessments ADD COLUMN IF NOT EXISTS course_type    TEXT;
ALTER TABLE coordinator_assessments ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Unique index for backend write path  (coordinator_id + component_key)
DROP INDEX IF EXISTS idx_coord_assess_coordinator;
CREATE UNIQUE INDEX idx_coord_assess_coordinator
  ON coordinator_assessments(group_id, coordinator_id, component_key)
  WHERE coordinator_id IS NOT NULL;

-- Unique index for frontend service write path  (course_id + component_key)
DROP INDEX IF EXISTS idx_coord_assess_course;
CREATE UNIQUE INDEX idx_coord_assess_course
  ON coordinator_assessments(group_id, course_id, component_key)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coord_assess_group ON coordinator_assessments(group_id);

-- ─── coordinator_evaluations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coordinator_evaluations (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  criterion_key     TEXT NOT NULL,
  raw_score         INTEGER NOT NULL DEFAULT 1 CHECK (raw_score >= 1 AND raw_score <= 5),
  submission_status TEXT DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if the table was created with an older schema
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS course_id      UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS course_type    TEXT;
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS criterion_id   UUID REFERENCES grading_rubric_criteria(id) ON DELETE SET NULL;
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS graded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE coordinator_evaluations ADD COLUMN IF NOT EXISTS graded_at      TIMESTAMPTZ DEFAULT now();

-- Unique index for backend write path  (coordinator_id + criterion_id)
DROP INDEX IF EXISTS idx_coord_eval_coordinator;
CREATE UNIQUE INDEX idx_coord_eval_coordinator
  ON coordinator_evaluations(group_id, coordinator_id, criterion_id)
  WHERE coordinator_id IS NOT NULL AND criterion_id IS NOT NULL;

-- Unique index for frontend service write path  (course_id + criterion_key)
DROP INDEX IF EXISTS idx_coord_eval_course;
CREATE UNIQUE INDEX idx_coord_eval_course
  ON coordinator_evaluations(group_id, course_id, criterion_key)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coord_eval_group ON coordinator_evaluations(group_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- The backend always uses supabaseAdmin (bypasses RLS).
-- Policies below cover direct Supabase anon-client access from the frontend.

ALTER TABLE coordinator_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_evaluations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coordinator can read assessments"  ON coordinator_assessments;
DROP POLICY IF EXISTS "Coordinator can write assessments" ON coordinator_assessments;
DROP POLICY IF EXISTS "Coordinator can read evaluations"  ON coordinator_evaluations;
DROP POLICY IF EXISTS "Coordinator can write evaluations" ON coordinator_evaluations;

CREATE POLICY "Coordinator can read assessments"
  ON coordinator_assessments FOR SELECT TO authenticated
  USING (
    coordinator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = coordinator_assessments.group_id AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY "Coordinator can write assessments"
  ON coordinator_assessments FOR ALL TO authenticated
  USING (
    coordinator_id = auth.uid()
    OR coordinator_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    coordinator_id = auth.uid()
    OR coordinator_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

CREATE POLICY "Coordinator can read evaluations"
  ON coordinator_evaluations FOR SELECT TO authenticated
  USING (
    coordinator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );

CREATE POLICY "Coordinator can write evaluations"
  ON coordinator_evaluations FOR ALL TO authenticated
  USING (
    coordinator_id = auth.uid()
    OR coordinator_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  )
  WITH CHECK (
    coordinator_id = auth.uid()
    OR coordinator_id IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'admin')
  );
