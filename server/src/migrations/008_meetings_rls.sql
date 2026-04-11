-- ─────────────────────────────────────────────────────────────────────────────
-- 008_meetings_rls.sql — Enable RLS on meetings tables
-- Run this in the Supabase SQL editor after 007_meetings.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── meetings ──────────────────────────────────────────────────────────────────

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read meetings they are a participant in
-- or that belong to groups they are a member of (students),
-- or that they created (coordinator/supervisor).
-- The server uses the service-role key (supabaseAdmin) which bypasses RLS,
-- so these policies protect direct client access only.

-- Coordinators & admins: see all meetings
CREATE POLICY "coordinators_read_all_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.roles @> ARRAY['coordinator'] OR profiles.roles @> ARRAY['admin'])
    )
  );

-- Supervisors: see meetings they created OR coordinator meetings for their groups
CREATE POLICY "supervisors_read_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.roles @> ARRAY['supervisor']
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM groups
        WHERE groups.id = meetings.group_id
          AND groups.supervisor_id = auth.uid()
      )
    )
  );

-- Students: see meetings for their group
CREATE POLICY "students_read_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = meetings.group_id
        AND group_members.user_id  = auth.uid()
    )
  );

-- Coordinators/admins/supervisors: insert
CREATE POLICY "staff_insert_meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.roles @> ARRAY['coordinator']
          OR profiles.roles @> ARRAY['admin']
          OR profiles.roles @> ARRAY['supervisor']
        )
    )
  );

-- Only creator can update
CREATE POLICY "creator_update_meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Only creator (or admin/coordinator) can delete
CREATE POLICY "creator_delete_meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.roles @> ARRAY['coordinator'] OR profiles.roles @> ARRAY['admin'])
    )
  );

-- ── meeting_participants ───────────────────────────────────────────────────────

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Coordinators/admins: see all participants
CREATE POLICY "coordinators_read_all_participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.roles @> ARRAY['coordinator'] OR profiles.roles @> ARRAY['admin'])
    )
  );

-- Supervisors: see participants for meetings they can access
CREATE POLICY "supervisors_read_participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.roles @> ARRAY['supervisor']
    )
    AND EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_participants.meeting_id
        AND (
          meetings.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = meetings.group_id
              AND groups.supervisor_id = auth.uid()
          )
        )
    )
  );

-- Students: see own participant rows
CREATE POLICY "students_read_own_participant"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff can insert participants
CREATE POLICY "staff_insert_participants"
  ON meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.roles @> ARRAY['coordinator']
          OR profiles.roles @> ARRAY['admin']
          OR profiles.roles @> ARRAY['supervisor']
        )
    )
  );

-- Staff can update participant rows (e.g. reminder flags)
CREATE POLICY "staff_update_participants"
  ON meeting_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.roles @> ARRAY['coordinator']
          OR profiles.roles @> ARRAY['admin']
          OR profiles.roles @> ARRAY['supervisor']
        )
    )
  );

-- Staff can delete participants
CREATE POLICY "staff_delete_participants"
  ON meeting_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.roles @> ARRAY['coordinator']
          OR profiles.roles @> ARRAY['admin']
          OR profiles.roles @> ARRAY['supervisor']
        )
    )
  );
