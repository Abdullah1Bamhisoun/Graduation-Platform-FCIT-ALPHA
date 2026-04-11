-- ─────────────────────────────────────────────────────────────────────────────
-- 008_meetings_rls.sql — Enable RLS on meetings tables
-- Run this in the Supabase SQL editor after 007_meetings.sql
--
-- NOTE: profiles.role enum only has: 'student', 'supervisor', 'admin'
--       Coordinators are stored as 'admin' in profiles.role.
--       The server always uses supabaseAdmin (service-role key) which bypasses
--       RLS entirely — these policies only protect direct client access.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── meetings ──────────────────────────────────────────────────────────────────

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Admins (includes coordinators): see all meetings
CREATE POLICY "admins_read_all_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'admin'
    )
  );

-- Supervisors: see meetings they created OR meetings for their groups
CREATE POLICY "supervisors_read_meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'supervisor'
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
      WHERE group_members.group_id  = meetings.group_id
        AND group_members.student_id = auth.uid()
    )
  );

-- Admins & supervisors: insert
CREATE POLICY "staff_insert_meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('admin', 'supervisor')
    )
  );

-- Only creator can update
CREATE POLICY "creator_update_meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Creator or admin can delete
CREATE POLICY "creator_delete_meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'admin'
    )
  );

-- ── meeting_participants ───────────────────────────────────────────────────────

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Admins: see all participants
CREATE POLICY "admins_read_all_participants"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'admin'
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
        AND profiles.role::text = 'supervisor'
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

-- Students: see their own participant row
CREATE POLICY "students_read_own_participant"
  ON meeting_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins & supervisors: insert participants
CREATE POLICY "staff_insert_participants"
  ON meeting_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('admin', 'supervisor')
    )
  );

-- Admins & supervisors: update participants (e.g. reminder flags)
CREATE POLICY "staff_update_participants"
  ON meeting_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('admin', 'supervisor')
    )
  );

-- Admins & supervisors: delete participants
CREATE POLICY "staff_delete_participants"
  ON meeting_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('admin', 'supervisor')
    )
  );
