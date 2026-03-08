-- ============================================================
-- Fix: Add SELECT RLS policies for submission_versions and
--      submission_feedback so students (and their group members)
--      can read their own submission data via the Supabase client.
--
-- Without these policies the Supabase fallback in the frontend
-- (getSubmissionByMilestoneAndGroup) returns nothing, causing the
-- student submission detail page to show no files, no feedback,
-- and no discussion.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── submission_versions: SELECT ─────────────────────────────────────────────
-- Allow any group member to read versions for their group's submissions.
-- Also allow supervisors, coordinators, and admins (authenticated is sufficient
-- since the backend uses supabaseAdmin; this policy covers the client fallback).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submission_versions'
      AND policyname = 'Group members can read submission versions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Group members can read submission versions"
        ON public.submission_versions
        FOR SELECT
        TO authenticated
        USING (
          submission_id IN (
            SELECT s.id FROM public.submissions s
            WHERE
              -- Student is the submitter
              s.student_id = auth.uid()
              -- OR student is a member of the submission's group
              OR s.group_id IN (
                SELECT gm.group_id FROM public.group_members gm
                WHERE gm.student_id = auth.uid()
              )
              -- OR user is a supervisor of the group
              OR s.group_id IN (
                SELECT g.id FROM public.groups g
                WHERE g.supervisor_id = auth.uid()
              )
          )
        );
    $policy$;
  END IF;
END;
$$;

-- ─── submission_feedback: SELECT ─────────────────────────────────────────────
-- Allow group members, supervisors, coordinators, and admins to read feedback.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submission_feedback'
      AND policyname = 'Group members can read submission feedback'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Group members can read submission feedback"
        ON public.submission_feedback
        FOR SELECT
        TO authenticated
        USING (
          submission_id IN (
            SELECT s.id FROM public.submissions s
            WHERE
              s.student_id = auth.uid()
              OR s.group_id IN (
                SELECT gm.group_id FROM public.group_members gm
                WHERE gm.student_id = auth.uid()
              )
              OR s.group_id IN (
                SELECT g.id FROM public.groups g
                WHERE g.supervisor_id = auth.uid()
              )
          )
          -- Also allow the reviewer themselves to read their own feedback records
          OR reviewed_by = auth.uid()
          -- Coordinators and admins
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role::text IN ('coordinator', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND r.name IN ('coordinator', 'admin')
          )
        );
    $policy$;
  END IF;
END;
$$;

-- ─── feedback_scores: SELECT ──────────────────────────────────────────────────
-- Allow reading individual criterion scores if the user can read the parent feedback.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'feedback_scores'
      AND policyname = 'Group members can read feedback scores'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Group members can read feedback scores"
        ON public.feedback_scores
        FOR SELECT
        TO authenticated
        USING (
          feedback_id IN (
            SELECT sf.id FROM public.submission_feedback sf
            JOIN public.submissions s ON s.id = sf.submission_id
            WHERE
              s.student_id = auth.uid()
              OR s.group_id IN (
                SELECT gm.group_id FROM public.group_members gm
                WHERE gm.student_id = auth.uid()
              )
              OR s.group_id IN (
                SELECT g.id FROM public.groups g
                WHERE g.supervisor_id = auth.uid()
              )
              OR sf.reviewed_by = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                  AND role::text IN ('coordinator', 'admin')
              )
          )
        );
    $policy$;
  END IF;
END;
$$;
