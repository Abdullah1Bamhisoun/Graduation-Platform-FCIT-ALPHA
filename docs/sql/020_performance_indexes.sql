-- ============================================================
-- Performance indexes for query-hot columns.
--
-- 019_fk_indexes.sql covers foreign-key columns.
-- This migration adds indexes for ORDER BY, WHERE, and
-- composite filter patterns that appear in hot query paths.
--
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- ============================================================

-- ── audit_log ────────────────────────────────────────────────
-- ORDER BY timestamp DESC in dashboard recent-activity query
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
  ON public.audit_log (timestamp DESC);

-- ── submissions ──────────────────────────────────────────────
-- ORDER BY updated_at DESC in supervisor/student submission lists
CREATE INDEX IF NOT EXISTS idx_submissions_updated_at
  ON public.submissions (updated_at DESC);

-- ORDER BY created_at in KPI sparkline / submission volume queries
CREATE INDEX IF NOT EXISTS idx_submissions_created_at
  ON public.submissions (created_at DESC);

-- Composite: group_id + status for supervisor "pending review" queries
CREATE INDEX IF NOT EXISTS idx_submissions_group_status
  ON public.submissions (group_id, status);

-- Composite: milestone_id + student_id for single-submission lookups
CREATE INDEX IF NOT EXISTS idx_submissions_milestone_student
  ON public.submissions (milestone_id, student_id);

-- ── milestones ───────────────────────────────────────────────
-- ORDER BY due_date in milestone lists (coordinator, student, dashboard)
CREATE INDEX IF NOT EXISTS idx_milestones_due_date
  ON public.milestones (due_date);

-- WHERE visible = true AND due_date > now() (upcoming events query)
CREATE INDEX IF NOT EXISTS idx_milestones_visible_due
  ON public.milestones (visible, due_date)
  WHERE visible = true;

-- ── group_members ────────────────────────────────────────────
-- Composite: group_id + student_id for membership checks
-- (single-column student_id index exists; this helps the reverse lookup)
CREATE INDEX IF NOT EXISTS idx_group_members_group_student
  ON public.group_members (group_id, student_id);

-- ── announcements ────────────────────────────────────────────
-- ORDER BY published_at DESC in announcement feed
CREATE INDEX IF NOT EXISTS idx_announcements_published_at
  ON public.announcements (published_at DESC);

-- ── calendar_events ──────────────────────────────────────────
-- ORDER BY date in calendar and upcoming-events queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date
  ON public.calendar_events (date);

-- ── supervisor_rubric_scores ─────────────────────────────────
-- WHERE student_id for per-student grade export
CREATE INDEX IF NOT EXISTS idx_supervisor_rubric_scores_student
  ON public.supervisor_rubric_scores (student_id);

-- ── week_statuses ────────────────────────────────────────────
-- WHERE course_type for week status lookups
CREATE INDEX IF NOT EXISTS idx_week_statuses_course_type
  ON public.week_statuses (course_type);
