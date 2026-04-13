-- ============================================================
-- RLS policies for peer_evaluations
--
-- Problem: the table has RLS enabled but no policies, so all
-- browser-client reads/writes were blocked (USING expression
-- policy violation).  All server-side code uses supabaseAdmin
-- (service role) which bypasses RLS, so it was unaffected.
-- These policies cover the cases where the browser client
-- legitimately needs direct access (SELECT only — writes go
-- through the server API at POST /api/students/peer-evaluations).
-- ============================================================

-- Enable RLS (idempotent)
ALTER TABLE IF EXISTS public.peer_evaluations ENABLE ROW LEVEL SECURITY;

-- Students can read evaluations they RECEIVED (to see their own peer score)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'peer_evaluations'
    AND policyname = 'Students read own received peer evaluations'
  ) THEN
    CREATE POLICY "Students read own received peer evaluations"
      ON public.peer_evaluations FOR SELECT
      USING (auth.uid() = student_id);
  END IF;
END$$;

-- Students can read evaluations they SUBMITTED (to pre-fill the edit form)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'peer_evaluations'
    AND policyname = 'Students read own submitted peer evaluations'
  ) THEN
    CREATE POLICY "Students read own submitted peer evaluations"
      ON public.peer_evaluations FOR SELECT
      USING (auth.uid() = evaluator_id);
  END IF;
END$$;

-- NOTE: INSERT/UPDATE go through POST /api/students/peer-evaluations (server role).
-- No client-side write policy is needed.
