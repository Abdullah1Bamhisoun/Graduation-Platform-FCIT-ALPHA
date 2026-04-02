-- Migration 006: Add group_id to announcements and calendar_events
-- for group-level scoping (supervisor ↔ group communication).
-- Run this once in the Supabase SQL editor.

-- 1. Add group_id to announcements
--    NULL = course-wide (visible to all in the course)
--    set  = scoped to a specific supervisor↔group pair
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 2. Add group_id to calendar_events
--    NULL = course-wide event
--    set  = event specific to a group
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 3. Indexes for fast group-scoped queries
CREATE INDEX IF NOT EXISTS idx_announcements_group_id
  ON announcements (group_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_group_id
  ON calendar_events (group_id);
