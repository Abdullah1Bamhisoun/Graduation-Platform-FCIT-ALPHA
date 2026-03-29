-- ============================================================
-- Migration 012: Per-user calendar events + weekly reports
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Add optional user_id to calendar_events so personal events
--    (e.g. "Review submission from Group X") are visible only to
--    the specific user. Events with user_id = NULL remain course-wide.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);

-- 2. Weekly reports table
--    One report per group per week. Students submit via POST /api/reports.
CREATE TABLE IF NOT EXISTS weekly_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES profiles(id),
  week_number   INTEGER     NOT NULL CHECK (week_number BETWEEN 1 AND 16),
  course_type   TEXT        NOT NULL CHECK (course_type IN ('498', '499')),
  content       TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'submitted'
                              CHECK (status IN ('submitted', 'reviewed', 'changes_requested')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_group ON weekly_reports(group_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week  ON weekly_reports(week_number);

-- 3. Weekly report comments (supervisor replies, student questions)
CREATE TABLE IF NOT EXISTS weekly_report_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID        NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id),
  author_role TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_report_comments_report ON weekly_report_comments(report_id);
