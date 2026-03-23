-- ============================================================
-- Migration 003: Idempotency Keys Table
-- Prevents duplicate mutations from retries / double-clicks.
-- Run this in the Supabase SQL editor or via supabase db push.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scoped_key   TEXT        NOT NULL UNIQUE,          -- user_id:endpoint:client-key
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL,
  status_code  INTEGER     NOT NULL,
  response_body JSONB      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for fast key lookups (the hot path)
CREATE INDEX IF NOT EXISTS idx_idempotency_scoped_key
  ON public.idempotency_keys (scoped_key);

-- Index to efficiently purge expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON public.idempotency_keys (expires_at);

-- Enable RLS — only the owning user (or service role) should ever touch these rows
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Service-role (backend) bypasses RLS automatically.
-- Prevent any direct client access:
CREATE POLICY "No direct client access to idempotency_keys"
  ON public.idempotency_keys
  FOR ALL
  USING (false);

-- ── Optional: scheduled cleanup function ──────────────────────────────────────
-- Call this from a pg_cron job or Supabase Edge Function cron:
--   SELECT cleanup_expired_idempotency_keys();

CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
