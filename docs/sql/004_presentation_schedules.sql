-- ============================================================
-- Migration: Presentation Schedules Table
-- Run this in your Supabase SQL editor (supabase.co → SQL Editor)
-- ============================================================

-- ─── presentation_schedules ──────────────────────────────────────────────────
-- One row per group. Upserts on group_id conflict.
-- NOTE: calendar_event_id is stored as a plain UUID (no FK) so this migration
--       works regardless of whether the calendar_events table exists yet.

CREATE TABLE IF NOT EXISTS presentation_schedules (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id          UUID        NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  day               TEXT        NOT NULL,
  time_slot         TEXT        NOT NULL,
  committee_members TEXT[]      NOT NULL DEFAULT '{}',
  scheduled_at      TIMESTAMPTZ,
  calendar_event_id UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Ensure group_id is unique (required for onConflict upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'presentation_schedules_group_id_key'
  ) THEN
    ALTER TABLE presentation_schedules ADD CONSTRAINT presentation_schedules_group_id_key UNIQUE (group_id);
  END IF;
END $$;

-- Add missing columns if the table already existed without them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'committee_members') THEN
    ALTER TABLE presentation_schedules ADD COLUMN committee_members TEXT[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'scheduled_at') THEN
    ALTER TABLE presentation_schedules ADD COLUMN scheduled_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'calendar_event_id') THEN
    ALTER TABLE presentation_schedules ADD COLUMN calendar_event_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'created_at') THEN
    ALTER TABLE presentation_schedules ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'updated_at') THEN
    ALTER TABLE presentation_schedules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_schedules' AND column_name = 'location') THEN
    ALTER TABLE presentation_schedules ADD COLUMN location TEXT;
  END IF;
END $$;

-- Index for fast lookups by group
CREATE INDEX IF NOT EXISTS idx_presentation_schedules_group
  ON presentation_schedules(group_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_presentation_schedules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presentation_schedules_updated_at ON presentation_schedules;
CREATE TRIGGER trg_presentation_schedules_updated_at
  BEFORE UPDATE ON presentation_schedules
  FOR EACH ROW EXECUTE FUNCTION update_presentation_schedules_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE presentation_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_presentation_schedules"  ON presentation_schedules;
DROP POLICY IF EXISTS "write_presentation_schedules" ON presentation_schedules;

-- Authenticated users can read schedules
CREATE POLICY "read_presentation_schedules"
  ON presentation_schedules FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins and coordinators can write
CREATE POLICY "write_presentation_schedules"
  ON presentation_schedules FOR ALL
  USING (is_coordinator_or_admin());
