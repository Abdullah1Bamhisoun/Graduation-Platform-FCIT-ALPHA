-- ============================================================
-- Migration 003 — Add project_status to groups table
-- Run this in Supabase SQL Editor before deploying the
-- "Groups Grades & Evaluation" supervisor tab.
-- ============================================================

-- ── 1. Add project_status column ─────────────────────────────────────────────
-- 'normal' = standard active project
-- 'ip'     = In Progress (project continues to next term; students do not advance to final defense)

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'normal'
    CHECK (project_status IN ('normal', 'ip'));

-- ── 2. Audit columns — who set IP and when ───────────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS ip_marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS ip_marked_at TIMESTAMPTZ;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS ip_reason TEXT;

-- ── 3. Backfill existing rows ─────────────────────────────────────────────────
UPDATE groups SET project_status = 'normal' WHERE project_status IS NULL;

-- ── 4. RLS — Supervisors can update only their assigned groups ─────────────────
-- (Supabase RLS example — adapt to your actual policy setup)
--
-- CREATE POLICY "supervisor can update own group project_status"
--   ON groups
--   FOR UPDATE
--   USING (supervisor_id = auth.uid())
--   WITH CHECK (supervisor_id = auth.uid());
--
-- The backend controller performs a secondary ownership check via supabaseAdmin
-- regardless, so this RLS policy is a defense-in-depth addition.

-- ── 5. Index for quick lookups by project_status ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_groups_project_status ON groups(project_status);
