-- Migration: add course_id to announcements for per-course isolation
-- Run this once in the Supabase SQL editor.

-- 1. Add the column
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- 2. Backfill coordinator-created announcements via platform_locks
UPDATE announcements a
SET course_id = pl.entity_id
FROM platform_locks pl
WHERE pl.entity_type = 'coordinator_assignment'
  AND pl.is_locked    = true
  AND a.author_id     = pl.locked_by
  AND a.course_id     IS NULL;

-- 3. Backfill milestone auto-announcements via the milestones table
--    (matches on title "New Milestone: <name>" + same author + same due date)
UPDATE announcements a
SET course_id = m.course_id
FROM milestones m
WHERE a.title     = 'New Milestone: ' || m.name
  AND a.expires_at::date = m.due_date::date
  AND a.course_id IS NULL;

-- 4. Index for fast coordinator-scoped queries
CREATE INDEX IF NOT EXISTS idx_announcements_course_id
  ON announcements (course_id);
