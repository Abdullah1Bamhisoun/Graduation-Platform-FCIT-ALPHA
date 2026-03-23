-- ============================================================
-- Enable Row-Level Security on ALL public tables
-- Run in Supabase SQL editor to audit and enforce RLS.
-- ============================================================

-- Step 1: Verify current RLS status across all public tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Step 2: Enable RLS on every public table that doesn't have it yet.
-- Each ALTER is idempotent (safe to re-run).

ALTER TABLE IF EXISTS public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.groups                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestones                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submissions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submission_versions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.submission_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.week_statuses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.important_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calendar_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pending_registrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.approvals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_locks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.presentations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.presentation_schedules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grading_components         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grading_rubric_criteria    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supervisor_rubric_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.committee_rubric_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coordinator_deliverable_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coordinator_evaluations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coordinator_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_files                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.document_highlights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_log                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.idempotency_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_switch_logs           ENABLE ROW LEVEL SECURITY;

-- ── Baseline "deny all direct client access" policies ─────────────────────────
-- The backend uses the service role (bypasses RLS) for all data access.
-- These policies block anyone using the anon/user Supabase key directly from the browser.
-- IMPORTANT: Review and replace these with proper granular policies for tables
-- where direct client access is intentional (e.g., storage via Supabase client).

-- profiles: users can read their own row; no direct writes from client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users read own profile'
  ) THEN
    CREATE POLICY "Users read own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END$$;

-- pending_registrations: public INSERT allowed (registration form); no client reads/updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pending_registrations'
    AND policyname = 'Public can submit registration'
  ) THEN
    CREATE POLICY "Public can submit registration"
      ON public.pending_registrations FOR INSERT
      WITH CHECK (true);
  END IF;
END$$;

-- announcements: authenticated users can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'announcements'
    AND policyname = 'Authenticated users read announcements'
  ) THEN
    CREATE POLICY "Authenticated users read announcements"
      ON public.announcements FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- important_files: authenticated users can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'important_files'
    AND policyname = 'Authenticated users read important files'
  ) THEN
    CREATE POLICY "Authenticated users read important files"
      ON public.important_files FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- audit_log: no direct client access (admin view is via service role API only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_log'
    AND policyname = 'No direct client access to audit_log'
  ) THEN
    CREATE POLICY "No direct client access to audit_log"
      ON public.audit_log FOR ALL
      USING (false);
  END IF;
END$$;
