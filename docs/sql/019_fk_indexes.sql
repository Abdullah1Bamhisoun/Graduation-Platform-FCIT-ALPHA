-- ============================================================
-- Add covering indexes for every un-indexed foreign key.
--
-- PostgreSQL does NOT create indexes on FK columns automatically.
-- Without them, DELETE/UPDATE on the parent table requires a
-- sequential scan of the child table to enforce referential
-- integrity, and JOINs on those columns also skip index paths.
--
-- Identified by Supabase Performance Advisor (lint 0001).
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- ============================================================

-- ── announcements ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_author_id
  ON public.announcements (author_id);

-- ── calendar_events ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calendar_events_course_id
  ON public.calendar_events (course_id);

-- ── committee_evaluations ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_committee_evaluations_course_id
  ON public.committee_evaluations (course_id);
CREATE INDEX IF NOT EXISTS idx_committee_evaluations_evaluator_id
  ON public.committee_evaluations (evaluator_id);
CREATE INDEX IF NOT EXISTS idx_committee_evaluations_group_id
  ON public.committee_evaluations (group_id);

-- ── committee_milestone_feedback ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_committee_milestone_feedback_course_id
  ON public.committee_milestone_feedback (course_id);
CREATE INDEX IF NOT EXISTS idx_committee_milestone_feedback_evaluator_id
  ON public.committee_milestone_feedback (evaluator_id);
CREATE INDEX IF NOT EXISTS idx_committee_milestone_feedback_milestone_id
  ON public.committee_milestone_feedback (milestone_id);

-- ── committee_rubric_scores ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_committee_rubric_scores_course_id
  ON public.committee_rubric_scores (course_id);
CREATE INDEX IF NOT EXISTS idx_committee_rubric_scores_evaluator_id
  ON public.committee_rubric_scores (evaluator_id);

-- ── coordinator_assessments ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coordinator_assessments_course_id
  ON public.coordinator_assessments (course_id);

-- ── coordinator_deliverable_scores ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_coordinator_deliverable_scores_course_id
  ON public.coordinator_deliverable_scores (course_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_deliverable_scores_graded_by
  ON public.coordinator_deliverable_scores (graded_by);

-- ── coordinator_evaluations ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coordinator_evaluations_course_id
  ON public.coordinator_evaluations (course_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_evaluations_criterion_id
  ON public.coordinator_evaluations (criterion_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_evaluations_graded_by
  ON public.coordinator_evaluations (graded_by);

-- ── courses ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_created_by
  ON public.courses (created_by);

-- ── criterion_student_outcomes ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_criterion_student_outcomes_outcome_id
  ON public.criterion_student_outcomes (outcome_id);

-- ── feedback_scores ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_scores_rubric_criterion_id
  ON public.feedback_scores (rubric_criterion_id);

-- ── group_deliverable_grades ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_deliverable_grades_course_id
  ON public.group_deliverable_grades (course_id);
CREATE INDEX IF NOT EXISTS idx_group_deliverable_grades_graded_by
  ON public.group_deliverable_grades (graded_by);

-- ── group_discussions ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_discussions_group_id
  ON public.group_discussions (group_id);
CREATE INDEX IF NOT EXISTS idx_group_discussions_user_id
  ON public.group_discussions (user_id);

-- ── group_files ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_files_course_id
  ON public.group_files (course_id);
CREATE INDEX IF NOT EXISTS idx_group_files_parent_file_id
  ON public.group_files (parent_file_id);
CREATE INDEX IF NOT EXISTS idx_group_files_uploaded_by
  ON public.group_files (uploaded_by);

-- ── group_members ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_members_student_id
  ON public.group_members (student_id);

-- ── groups ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_course_id
  ON public.groups (course_id);
CREATE INDEX IF NOT EXISTS idx_groups_supervisor_id
  ON public.groups (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_groups_ip_marked_by
  ON public.groups (ip_marked_by);

-- ── highlight_comments ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_highlight_comments_user_id
  ON public.highlight_comments (user_id);

-- ── idempotency_keys ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id
  ON public.idempotency_keys (user_id);

-- ── milestones ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_milestones_course_id
  ON public.milestones (course_id);

-- ── peer_evaluations ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_course_id
  ON public.peer_evaluations (course_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_evaluator_id
  ON public.peer_evaluations (evaluator_id);
CREATE INDEX IF NOT EXISTS idx_peer_evaluations_group_id
  ON public.peer_evaluations (group_id);

-- ── pending_registrations ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pending_registrations_reviewed_by
  ON public.pending_registrations (reviewed_by);

-- ── platform_locks ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_locks_locked_by
  ON public.platform_locks (locked_by);
CREATE INDEX IF NOT EXISTS idx_platform_locks_unlocked_by
  ON public.platform_locks (unlocked_by);

-- ── presentation_schedules ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_presentation_schedules_calendar_event_id
  ON public.presentation_schedules (calendar_event_id);

-- ── profiles ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_coordinator_course_id
  ON public.profiles (coordinator_course_id);

-- ── role_switch_logs ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_role_switch_logs_user_id
  ON public.role_switch_logs (user_id);

-- ── rubric_criteria ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_milestone_id
  ON public.rubric_criteria (milestone_id);

-- ── submission_comments ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submission_comments_author_id
  ON public.submission_comments (author_id);

-- ── submission_feedback ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submission_feedback_reviewed_by
  ON public.submission_feedback (reviewed_by);

-- ── submissions ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submissions_group_id
  ON public.submissions (group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id
  ON public.submissions (student_id);

-- ── supervisor_assessments ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supervisor_assessments_course_id
  ON public.supervisor_assessments (course_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assessments_group_id
  ON public.supervisor_assessments (group_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assessments_graded_by
  ON public.supervisor_assessments (graded_by);

-- ── supervisor_rubric_scores ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supervisor_rubric_scores_course_id
  ON public.supervisor_rubric_scores (course_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_rubric_scores_group_id
  ON public.supervisor_rubric_scores (group_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_rubric_scores_graded_by
  ON public.supervisor_rubric_scores (graded_by);

-- ── user_roles ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON public.user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_coordinator_course_id
  ON public.user_roles (coordinator_course_id);

-- ── week_statuses ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_week_statuses_updated_by
  ON public.week_statuses (updated_by);

-- ── weekly_report_comments ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_report_comments_author_id
  ON public.weekly_report_comments (author_id);

-- ── weekly_reports ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_reports_course_id
  ON public.weekly_reports (course_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_reviewed_by
  ON public.weekly_reports (reviewed_by);

-- ============================================================
-- Unused indexes reported by Performance Advisor (lint 0005).
--
-- These indexes exist but the query planner has not used them
-- since statistics were last reset. They add write overhead
-- with no read benefit under current query patterns.
--
-- Review and uncomment the DROP statements if confirmed safe:
--
--   DROP INDEX IF EXISTS public.idx_week_statuses_close_at;
--   DROP INDEX IF EXISTS public.idx_presentation_schedules_group;
--   DROP INDEX IF EXISTS public.idx_calendar_events_user_id;
--   DROP INDEX IF EXISTS public.idx_calendar_events_group_id;
--   DROP INDEX IF EXISTS public.idx_weekly_reports_group;
--   DROP INDEX IF EXISTS public.idx_submission_feedback_submission;
--   DROP INDEX IF EXISTS public.idx_milestones_grading_criterion;
--
-- Note: idx_calendar_events_group_id and idx_calendar_events_user_id
-- cover FK columns — dropping them re-exposes those FKs. Keep or
-- replace with the new idx_calendar_events_course_id above.
-- ============================================================
