-- ─── Migration 012: Weekly Report Submission Window ──────────────────────────
-- Adds coordinator-configurable open_at / close_at datetime columns to
-- week_statuses so coordinators can set exact submission windows.
-- Run this in the Supabase SQL Editor.

-- Add open_at: when the submission window opens (nullable = not scheduled)
ALTER TABLE IF EXISTS public.week_statuses
  ADD COLUMN IF NOT EXISTS open_at  timestamptz DEFAULT NULL;

-- Add close_at: when the submission window closes / deadline (nullable)
ALTER TABLE IF EXISTS public.week_statuses
  ADD COLUMN IF NOT EXISTS close_at timestamptz DEFAULT NULL;

-- Index for efficient deadline-reminder queries
CREATE INDEX IF NOT EXISTS idx_week_statuses_close_at
  ON public.week_statuses (close_at)
  WHERE close_at IS NOT NULL;

-- ─── RLS: allow coordinators/admins to update the new columns ─────────────────
-- The existing update policies on week_statuses cover all columns via UPDATE,
-- so no additional policy is needed. Verify your existing policy allows UPDATE
-- on the week_statuses table for coordinator and admin roles.

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'week_statuses'
-- ORDER BY ordinal_position;
