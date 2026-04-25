-- ============================================================
-- RLS policies for student_outcomes and criterion_student_outcomes
--
-- Both tables were missing RLS entirely, exposing them to
-- unauthenticated reads via PostgREST (flagged by Supabase linter).
--
-- Access model:
--   student_outcomes          — any authenticated user reads; coordinator/admin writes
--   criterion_student_outcomes — any authenticated user reads; coordinator/admin writes
-- ============================================================

-- ── student_outcomes ─────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.student_outcomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_outcomes'
    AND policyname = 'Authenticated users read student outcomes'
  ) THEN
    CREATE POLICY "Authenticated users read student outcomes"
      ON public.student_outcomes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_outcomes'
    AND policyname = 'Coordinator manages student outcomes'
  ) THEN
    CREATE POLICY "Coordinator manages student outcomes"
      ON public.student_outcomes FOR ALL
      USING (is_coordinator_or_admin())
      WITH CHECK (is_coordinator_or_admin());
  END IF;
END$$;

-- ── criterion_student_outcomes ───────────────────────────────────────────────

ALTER TABLE IF EXISTS public.criterion_student_outcomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'criterion_student_outcomes'
    AND policyname = 'Authenticated users read criterion outcomes'
  ) THEN
    CREATE POLICY "Authenticated users read criterion outcomes"
      ON public.criterion_student_outcomes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'criterion_student_outcomes'
    AND policyname = 'Coordinator manages criterion outcomes'
  ) THEN
    CREATE POLICY "Coordinator manages criterion outcomes"
      ON public.criterion_student_outcomes FOR ALL
      USING (is_coordinator_or_admin())
      WITH CHECK (is_coordinator_or_admin());
  END IF;
END$$;
