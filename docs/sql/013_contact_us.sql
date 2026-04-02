-- ─── Migration 013: Contact Us / Support Page ────────────────────────────────
-- Creates two tables:
--   1. contact_coordinator_info  — per-course optional extra fields
--      (email is auto-fetched from user_roles + profiles; not stored here)
--   2. contact_support_info      — singleton support-team contact details
-- Run this in the Supabase SQL Editor.

-- ─── 1. Per-course coordinator contact extras ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_coordinator_info (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id   uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  phone       text,
  custom_name text,
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT contact_coordinator_info_course_unique UNIQUE (course_id)
);

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION public.set_contact_coordinator_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_coordinator_updated_at ON public.contact_coordinator_info;
CREATE TRIGGER trg_contact_coordinator_updated_at
  BEFORE UPDATE ON public.contact_coordinator_info
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_coordinator_updated_at();

-- ─── 2. Support team contact info ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_support_info (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  support_email text        NOT NULL,
  phone         text,
  description   text,
  updated_at    timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_contact_support_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_support_updated_at ON public.contact_support_info;
CREATE TRIGGER trg_contact_support_updated_at
  BEFORE UPDATE ON public.contact_support_info
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_support_updated_at();

-- ─── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.contact_coordinator_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_support_info     ENABLE ROW LEVEL SECURITY;

-- Drop policies first so re-running the migration is safe
DROP POLICY IF EXISTS "contact_coordinator_info_select_all"        ON public.contact_coordinator_info;
DROP POLICY IF EXISTS "contact_coordinator_info_write_coordinator"  ON public.contact_coordinator_info;
DROP POLICY IF EXISTS "contact_coordinator_info_write_admin"        ON public.contact_coordinator_info;
DROP POLICY IF EXISTS "contact_support_info_select_all"            ON public.contact_support_info;
DROP POLICY IF EXISTS "contact_support_info_write_admin"           ON public.contact_support_info;

-- Everyone (authenticated) can read coordinator contact info
CREATE POLICY "contact_coordinator_info_select_all"
  ON public.contact_coordinator_info
  FOR SELECT USING (true);

-- Coordinator: can insert/update/delete their own course's row
CREATE POLICY "contact_coordinator_info_write_coordinator"
  ON public.contact_coordinator_info
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles       r  ON r.id = ur.role_id
      WHERE  ur.user_id                = auth.uid()
        AND  r.name                    = 'coordinator'
        AND  ur.coordinator_course_id  = course_id
    )
  );

-- Admin: can insert/update/delete any row
CREATE POLICY "contact_coordinator_info_write_admin"
  ON public.contact_coordinator_info
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles       r ON r.id = ur.role_id
      WHERE  ur.user_id = auth.uid()
        AND  r.name     = 'admin'
    )
  );

-- Everyone (authenticated) can read support info
CREATE POLICY "contact_support_info_select_all"
  ON public.contact_support_info
  FOR SELECT USING (true);

-- Only admin can write support info
CREATE POLICY "contact_support_info_write_admin"
  ON public.contact_support_info
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM   public.user_roles ur
      JOIN   public.roles       r ON r.id = ur.role_id
      WHERE  ur.user_id = auth.uid()
        AND  r.name     = 'admin'
    )
  );

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT table_name, column_name, data_type
-- FROM   information_schema.columns
-- WHERE  table_name IN ('contact_coordinator_info', 'contact_support_info')
-- ORDER  BY table_name, ordinal_position;
