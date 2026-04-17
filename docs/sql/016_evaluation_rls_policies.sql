-- ============================================================
-- RLS policies for committee_evaluations and supervisor_assessments
--
-- Problem: these tables have RLS enabled but no write policies,
-- so browser-client writes from GradingEvaluation.tsx and
-- GradingAssessment.tsx (which use the frontend Supabase client
-- via grading-rubric.ts) were blocked with
-- "new row violates row-level security policy".
--
-- Server-side code (supabaseAdmin / service role) bypasses RLS
-- entirely, so the new backend endpoints are unaffected.
-- These policies cover the direct-client write paths.
-- ============================================================

-- ── committee_evaluations ────────────────────────────────────────────────────

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.committee_evaluations ENABLE ROW LEVEL SECURITY;

-- Evaluator can read their own entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'committee_evaluations'
    AND policyname = 'Committee evaluator reads own entries'
  ) THEN
    CREATE POLICY "Committee evaluator reads own entries"
      ON public.committee_evaluations FOR SELECT
      USING (
        evaluator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = group_id
            AND is_coordinator_for_course(g.course_id)
        )
        OR EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = group_id
            AND gm.student_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Evaluator can insert/update their own evaluation rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'committee_evaluations'
    AND policyname = 'Committee evaluator writes own entries'
  ) THEN
    CREATE POLICY "Committee evaluator writes own entries"
      ON public.committee_evaluations FOR ALL
      USING (
        evaluator_id = auth.uid()
        OR is_coordinator_or_admin()
      )
      WITH CHECK (
        evaluator_id = auth.uid()
        OR is_coordinator_or_admin()
      );
  END IF;
END$$;

-- ── supervisor_assessments ───────────────────────────────────────────────────

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.supervisor_assessments ENABLE ROW LEVEL SECURITY;

-- Supervisor can read grades they submitted; students can read their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supervisor_assessments'
    AND policyname = 'Supervisor reads own assessment entries'
  ) THEN
    CREATE POLICY "Supervisor reads own assessment entries"
      ON public.supervisor_assessments FOR SELECT
      USING (
        graded_by = auth.uid()
        OR student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = group_id
            AND is_coordinator_for_course(g.course_id)
        )
      );
  END IF;
END$$;

-- Supervisor can insert/update assessment rows for their own groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supervisor_assessments'
    AND policyname = 'Supervisor writes own assessment entries'
  ) THEN
    CREATE POLICY "Supervisor writes own assessment entries"
      ON public.supervisor_assessments FOR ALL
      USING (
        graded_by = auth.uid()
        OR is_coordinator_or_admin()
      )
      WITH CHECK (
        graded_by = auth.uid()
        OR is_coordinator_or_admin()
      );
  END IF;
END$$;
