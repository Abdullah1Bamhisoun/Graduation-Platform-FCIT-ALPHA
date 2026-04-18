-- ─────────────────────────────────────────────────────────────────────────────
-- 009_meetings_location.sql
-- • Allows on-campus meetings: meeting_url is now nullable
-- • Adds location column for on-campus meeting room/office details
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE meetings
  ALTER COLUMN meeting_url DROP NOT NULL;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS location TEXT;
