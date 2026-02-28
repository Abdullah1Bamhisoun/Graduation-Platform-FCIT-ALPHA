-- Migration: Add Coordinator Evaluation Tables
-- Purpose: Store coordinator-submitted rubric-based evaluations
-- Date: 2024-02-28
--
-- This migration creates two new tables:
-- 1. coordinator_evaluations - Stores individual criterion scores (parallel to supervisor_rubric_scores)
-- 2. coordinator_assessments - Stores normalized component scores (parallel to supervisor_assessments)
--
-- Both tables use RLS policies to restrict access by coordinator

-- ============================================================================
-- TABLE 1: coordinator_evaluations
-- ============================================================================
-- Purpose: Store raw scores for each criterion in coordinator evaluation
-- Structure: Parallel to supervisor_rubric_scores table
-- Key Fields:
--   - group_id: Which group is being evaluated
--   - coordinator_id: Which coordinator submitted the evaluation
--   - criterion_id: Which rubric criterion is being scored
--   - raw_score: The score given (1-5 range)
--   - submission_status: draft or submitted

CREATE TABLE IF NOT EXISTS coordinator_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      course_type TEXT NOT NULL CHECK (course_type IN ('498', '499')),
        coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

          -- Rubric criterion reference
            criterion_id UUID NOT NULL REFERENCES grading_rubric_criteria(id) ON DELETE RESTRICT,
              criterion_key TEXT NOT NULL,

                -- Raw score (1-5 Likert scale for coordinator_eval component)
                  raw_score INTEGER NOT NULL CHECK (raw_score >= 1 AND raw_score <= 5),

                    -- Submission status
                      submission_status TEXT DEFAULT 'draft'
                          CHECK (submission_status IN ('draft', 'submitted')),

                            -- Timestamps
                              created_at TIMESTAMP DEFAULT NOW(),
                                updated_at TIMESTAMP DEFAULT NOW(),

                                  -- Uniqueness: One entry per group per coordinator per criterion
                                    UNIQUE (group_id, coordinator_id, criterion_id)
                                    );

                                    -- Create indexes for common queries
                                    CREATE INDEX IF NOT EXISTS idx_coordinator_evals_group_course
                                      ON coordinator_evaluations(group_id, course_type);
                                      CREATE INDEX IF NOT EXISTS idx_coordinator_evals_coordinator_course
                                        ON coordinator_evaluations(coordinator_id, course_type);
                                        CREATE INDEX IF NOT EXISTS idx_coordinator_evals_status
                                          ON coordinator_evaluations(submission_status);

                                          -- Enable Row Level Security
                                          ALTER TABLE coordinator_evaluations ENABLE ROW LEVEL SECURITY;

                                          -- RLS Policy 1: SELECT - Coordinators see their own, Admin sees all
                                          DROP POLICY IF EXISTS "Coordinators see own evals, Admin sees all" ON coordinator_evaluations;
                                          CREATE POLICY "Coordinators see own evals, Admin sees all"
                                            ON coordinator_evaluations FOR SELECT
                                              USING (
                                                  auth.uid() = coordinator_id
                                                      OR (
                                                            SELECT COUNT(*) > 0 FROM user_roles ur
                                                                  INNER JOIN roles r ON ur.role_id = r.id
                                                                        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
                                                                            )
                                                                              );

                                                                              -- RLS Policy 2: INSERT - Only coordinators can insert their own
                                                                              DROP POLICY IF EXISTS "Coordinators insert own evals" ON coordinator_evaluations;
                                                                              CREATE POLICY "Coordinators insert own evals"
                                                                                ON coordinator_evaluations FOR INSERT
                                                                                  WITH CHECK (auth.uid() = coordinator_id);

                                                                                  -- RLS Policy 3: UPDATE - Only coordinators can update their own
                                                                                  DROP POLICY IF EXISTS "Coordinators update own evals" ON coordinator_evaluations;
                                                                                  CREATE POLICY "Coordinators update own evals"
                                                                                    ON coordinator_evaluations FOR UPDATE
                                                                                      USING (auth.uid() = coordinator_id)
                                                                                        WITH CHECK (auth.uid() = coordinator_id);

                                                                                        -- RLS Policy 4: DELETE - Only coordinators can delete their own
                                                                                        DROP POLICY IF EXISTS "Coordinators delete own evals" ON coordinator_evaluations;
                                                                                        CREATE POLICY "Coordinators delete own evals"
                                                                                          ON coordinator_evaluations FOR DELETE
                                                                                            USING (auth.uid() = coordinator_id);

                                                                                            -- ============================================================================
                                                                                            -- TABLE 2: coordinator_assessments
                                                                                            -- ============================================================================
                                                                                            -- Purpose: Store normalized coordinator scores per component
                                                                                            -- Structure: Parallel to supervisor_assessments table
                                                                                            -- Key Fields:
                                                                                            --   - group_id: Which group is being evaluated
                                                                                            --   - coordinator_id: Which coordinator submitted the evaluation
                                                                                            --   - component_key: Which grade component (e.g., 'coordinator_eval')
                                                                                            --   - normalized_score: Score normalized to component weight
                                                                                            --   - max_score: Maximum possible score for this component
                                                                                            --   - submission_status: draft or submitted

                                                                                            CREATE TABLE IF NOT EXISTS coordinator_assessments (
                                                                                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                                                                                group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                                                                                                  course_type TEXT NOT NULL CHECK (course_type IN ('498', '499')),
                                                                                                    coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

                                                                                                      -- Component reference
                                                                                                        component_key TEXT NOT NULL,  -- e.g., 'coordinator_eval'

                                                                                                          -- Normalized score (calculated from raw scores)
                                                                                                            -- Formula: (sum_of_raw_scores / max_raw_score) * component_weight
                                                                                                              normalized_score NUMERIC(5,2),
                                                                                                                max_score INTEGER,

                                                                                                                  -- Submission status
                                                                                                                    submission_status TEXT DEFAULT 'draft'
                                                                                                                        CHECK (submission_status IN ('draft', 'submitted')),

                                                                                                                          -- Timestamps
                                                                                                                            created_at TIMESTAMP DEFAULT NOW(),
                                                                                                                              updated_at TIMESTAMP DEFAULT NOW(),

                                                                                                                                -- Uniqueness: One assessment per group per coordinator per component
                                                                                                                                  UNIQUE (group_id, coordinator_id, component_key)
                                                                                                                                  );

                                                                                                                                  -- Create indexes for common queries
                                                                                                                                  CREATE INDEX IF NOT EXISTS idx_coordinator_assess_group_course
                                                                                                                                    ON coordinator_assessments(group_id, course_type);
                                                                                                                                    CREATE INDEX IF NOT EXISTS idx_coordinator_assess_coordinator
                                                                                                                                      ON coordinator_assessments(coordinator_id);
                                                                                                                                      CREATE INDEX IF NOT EXISTS idx_coordinator_assess_status
                                                                                                                                        ON coordinator_assessments(submission_status);

                                                                                                                                        -- Enable Row Level Security
                                                                                                                                        ALTER TABLE coordinator_assessments ENABLE ROW LEVEL SECURITY;

                                                                                                                                        -- RLS Policy 1: SELECT - Coordinators see their own, Admin sees all
                                                                                                                                        DROP POLICY IF EXISTS "Coordinators see own assessments, Admin sees all" ON coordinator_assessments;
                                                                                                                                        CREATE POLICY "Coordinators see own assessments, Admin sees all"
                                                                                                                                          ON coordinator_assessments FOR SELECT
                                                                                                                                            USING (
                                                                                                                                                auth.uid() = coordinator_id
                                                                                                                                                    OR (
                                                                                                                                                          SELECT COUNT(*) > 0 FROM user_roles ur
                                                                                                                                                                INNER JOIN roles r ON ur.role_id = r.id
                                                                                                                                                                      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
                                                                                                                                                                          )
                                                                                                                                                                            );

                                                                                                                                                                            -- RLS Policy 2: INSERT - Only coordinators can insert their own
                                                                                                                                                                            DROP POLICY IF EXISTS "Coordinators insert own assessments" ON coordinator_assessments;
                                                                                                                                                                            CREATE POLICY "Coordinators insert own assessments"
                                                                                                                                                                              ON coordinator_assessments FOR INSERT
                                                                                                                                                                                WITH CHECK (auth.uid() = coordinator_id);

                                                                                                                                                                                -- RLS Policy 3: UPDATE - Only coordinators can update their own
                                                                                                                                                                                DROP POLICY IF EXISTS "Coordinators update own assessments" ON coordinator_assessments;
                                                                                                                                                                                CREATE POLICY "Coordinators update own assessments"
                                                                                                                                                                                  ON coordinator_assessments FOR UPDATE
                                                                                                                                                                                    USING (auth.uid() = coordinator_id)
                                                                                                                                                                                      WITH CHECK (auth.uid() = coordinator_id);

                                                                                                                                                                                      -- RLS Policy 4: DELETE - Only coordinators can delete their own
                                                                                                                                                                                      DROP POLICY IF EXISTS "Coordinators delete own assessments" ON coordinator_assessments;
                                                                                                                                                                                      CREATE POLICY "Coordinators delete own assessments"
                                                                                                                                                                                        ON coordinator_assessments FOR DELETE
                                                                                                                                                                                          USING (auth.uid() = coordinator_id);

                                                                                                                                                                                          -- ============================================================================
                                                                                                                                                                                          -- VERIFICATION QUERIES (Run these to verify migration success)
                                                                                                                                                                                          -- ============================================================================
                                                                                                                                                                                          -- SELECT table_name FROM information_schema.tables
                                                                                                                                                                                          --   WHERE table_name IN ('coordinator_evaluations', 'coordinator_assessments');
                                                                                                                                                                                          --
                                                                                                                                                                                          -- SELECT schemaname, tablename FROM pg_tables
                                                                                                                                                                                          --   WHERE tablename IN ('coordinator_evaluations', 'coordinator_assessments');

                                                                                                                                                                                          