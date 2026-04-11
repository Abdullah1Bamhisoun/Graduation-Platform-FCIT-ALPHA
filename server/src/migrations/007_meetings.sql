-- ─────────────────────────────────────────────────────────────────────────────
-- 007_meetings.sql — Meeting Management Module
-- Creates meetings and meeting_participants tables with RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── meetings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  meeting_url   TEXT        NOT NULL,
  date_time     TIMESTAMPTZ NOT NULL,
  group_id      UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_role  TEXT        NOT NULL CHECK (creator_role IN ('coordinator', 'supervisor')),
  status        TEXT        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_group_id    ON meetings (group_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by  ON meetings (created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_date_time   ON meetings (date_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status      ON meetings (status);

-- ── meeting_participants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL CHECK (role IN ('student', 'supervisor', 'coordinator')),
  email_sent    BOOLEAN     NOT NULL DEFAULT FALSE,
  reminder_24h  BOOLEAN     NOT NULL DEFAULT FALSE,
  reminder_1h   BOOLEAN     NOT NULL DEFAULT FALSE,
  reminder_10m  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants (meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id    ON meeting_participants (user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings;
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_meetings_updated_at();
