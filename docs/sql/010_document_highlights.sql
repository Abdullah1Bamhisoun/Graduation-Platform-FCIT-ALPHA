-- ============================================================
-- Inline document highlights and comments (Google Docs–style)
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Highlights table — one row per highlighted text region
CREATE TABLE IF NOT EXISTS document_highlights (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      TEXT        NOT NULL,   -- file_path (e.g. submissions/…/file.pdf)
  selected_text    TEXT        NOT NULL,
  page_number      INTEGER     NOT NULL DEFAULT 1,
  -- Position of the highlight rectangle as % of the rendered page dimensions
  x_percent        FLOAT       NOT NULL DEFAULT 0,
  y_percent        FLOAT       NOT NULL DEFAULT 0,
  width_percent    FLOAT       NOT NULL DEFAULT 0,
  height_percent   FLOAT       NOT NULL DEFAULT 0,
  -- Character offsets within the page's extracted text (optional – for future use)
  start_position   INTEGER,
  end_position     INTEGER,
  highlight_color  TEXT        NOT NULL DEFAULT '#FFF59D',
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_highlights_document ON document_highlights(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_highlights_user     ON document_highlights(user_id);

-- Comments on a highlight — one row per reply
CREATE TABLE IF NOT EXISTS highlight_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id  UUID        NOT NULL REFERENCES document_highlights(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlight_comments_highlight ON highlight_comments(highlight_id);

-- RLS — backend enforces fine-grained access control
ALTER TABLE document_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_comments   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_highlights' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY authenticated_all ON document_highlights
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'highlight_comments' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY authenticated_all ON highlight_comments
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
