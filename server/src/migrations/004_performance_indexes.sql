-- ============================================================
-- Migration 004: Performance Indexes
-- Adds indexes on all frequently-queried columns to prevent
-- full table scans as the platform scales.
-- All statements use IF NOT EXISTS — safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── groups ────────────────────────────────────────────────────────────────────
-- getSupervisorGroupsWithGrades, getChapterSubmissionsForSupervisor
CREATE INDEX IF NOT EXISTS idx_groups_supervisor_id
  ON public.groups (supervisor_id);

-- getAllGroups, coordinator-scoped queries
CREATE INDEX IF NOT EXISTS idx_groups_course_id
  ON public.groups (course_id);

-- ── group_members ─────────────────────────────────────────────────────────────
-- approveRegistration membership check, student submission access
CREATE INDEX IF NOT EXISTS idx_group_members_student_id
  ON public.group_members (student_id);

-- Reverse lookup: all students in a group
CREATE INDEX IF NOT EXISTS idx_group_members_group_id
  ON public.group_members (group_id);

-- ── submissions ───────────────────────────────────────────────────────────────
-- getGroupSubmission, getGroupMilestoneStatuses
CREATE INDEX IF NOT EXISTS idx_submissions_group_id
  ON public.submissions (group_id);

-- Milestone-scoped submission lookups
CREATE INDEX IF NOT EXISTS idx_submissions_milestone_id
  ON public.submissions (milestone_id);

-- Student-specific submission lookups
CREATE INDEX IF NOT EXISTS idx_submissions_student_id
  ON public.submissions (student_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON public.submissions (status);

-- ── submission_versions ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id
  ON public.submission_versions (submission_id);

-- ── submission_comments ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_id
  ON public.submission_comments (submission_id);

-- ── pending_registrations ─────────────────────────────────────────────────────
-- submitRegistration duplicate check
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email
  ON public.pending_registrations (email);

-- listRegistrations status filter
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status
  ON public.pending_registrations (status);

-- Coordinator course-scoped queries
CREATE INDEX IF NOT EXISTS idx_pending_registrations_course_id
  ON public.pending_registrations (course_id);

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Email-based lookups (approveRegistration, rejectRegistration)
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles (email);

-- Role-based filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

-- ── user_roles ────────────────────────────────────────────────────────────────
-- authenticate() role loading
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
  ON public.user_roles (user_id);

-- ── milestones ────────────────────────────────────────────────────────────────
-- Course-scoped milestone listing
CREATE INDEX IF NOT EXISTS idx_milestones_course_id
  ON public.milestones (course_id);

-- Due date ordering (default sort)
CREATE INDEX IF NOT EXISTS idx_milestones_due_date
  ON public.milestones (due_date);

-- ── announcements ─────────────────────────────────────────────────────────────
-- Date-ordered listing
CREATE INDEX IF NOT EXISTS idx_announcements_published_at
  ON public.announcements (published_at DESC);

-- ── weekly_reports ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_reports_group_id
  ON public.weekly_reports (group_id);

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Admin audit trail queries
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity);

-- ── idempotency_keys (already indexed in 003 migration) ──────────────────────
-- Included here for completeness — these are no-ops if 003 was run.
CREATE INDEX IF NOT EXISTS idx_idempotency_scoped_key
  ON public.idempotency_keys (scoped_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON public.idempotency_keys (expires_at);

-- ── platform_locks ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_locks_entity_type
  ON public.platform_locks (entity_type);

-- ── Verification query — run after to confirm all indexes were created ─────────
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
