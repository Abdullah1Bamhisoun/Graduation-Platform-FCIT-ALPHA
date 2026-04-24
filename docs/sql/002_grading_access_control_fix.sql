-- ============================================================
-- Grading System: Course-Level Access Control Fix
-- Run this AFTER 001_full_grading_system.sql in Supabase
-- ============================================================
-- This migration enforces that:
-- 1. Supervisors can only see/grade their own groups
-- 2. Coordinators can only see/edit grades for their assigned course
-- 3. Committee members can only see/grade their assigned groups
-- 4. Students can only see grades for their own group

-- ============================================================
-- STEP 1: DELETE ALL EXISTING GRADES (NEW & LEGACY TABLES)
-- ============================================================
-- Each delete is wrapped in a DO block so missing tables are skipped safely.

DO $$ BEGIN
  -- New rubric tables
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supervisor_rubric_scores')    THEN DELETE FROM supervisor_rubric_scores;    END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'committee_rubric_scores')     THEN DELETE FROM committee_rubric_scores;     END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coordinator_deliverable_scores') THEN DELETE FROM coordinator_deliverable_scores; END IF;
  -- Legacy tables
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supervisor_assessments')      THEN DELETE FROM supervisor_assessments;      END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'committee_evaluations')       THEN DELETE FROM committee_evaluations;       END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_committee_scores')      THEN DELETE FROM admin_committee_scores;      END IF;
END $$;

-- ============================================================
-- STEP 2: DROP EXISTING PERMISSIVE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "read_rubric_criteria"    ON grading_rubric_criteria;
DROP POLICY IF EXISTS "read_grading_components" ON grading_components;
DROP POLICY IF EXISTS "read_sup_rubric"         ON supervisor_rubric_scores;
DROP POLICY IF EXISTS "read_comm_rubric"        ON committee_rubric_scores;
DROP POLICY IF EXISTS "read_coord_deliverables" ON coordinator_deliverable_scores;

DROP POLICY IF EXISTS "write_rubric_criteria" ON grading_rubric_criteria;
DROP POLICY IF EXISTS "write_grading_components" ON grading_components;
DROP POLICY IF EXISTS "write_sup_rubric" ON supervisor_rubric_scores;
DROP POLICY IF EXISTS "write_comm_rubric" ON committee_rubric_scores;
DROP POLICY IF EXISTS "write_coord_deliverables" ON coordinator_deliverable_scores;

-- ============================================================
-- STEP 3: CREATE HELPER FUNCTIONS FOR ACCESS CONTROL
-- ============================================================

-- Check if user is coordinator or admin
CREATE OR REPLACE FUNCTION is_coordinator_or_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role::text IN ('coordinator', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('coordinator', 'admin')
    );
$$;

-- Check if user is the coordinator for a specific course
CREATE OR REPLACE FUNCTION is_coordinator_for_course(course_id UUID) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('coordinator', 'admin')
        AND ur.coordinator_course_id = course_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role::text = 'admin'
    );
$$;

-- Check if user is a supervisor/member of a group
CREATE OR REPLACE FUNCTION is_group_supervisor(group_id UUID) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM groups
      WHERE id = group_id
        AND supervisor_id = auth.uid()
    );
$$;

-- Check if user is a student in a group
CREATE OR REPLACE FUNCTION is_group_member(group_id UUID) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_id
        AND student_id = auth.uid()
    );
$$;

-- ============================================================
-- STEP 4: RUBRIC CRITERIA & COMPONENTS (READ-ONLY, All Authenticated)
-- ============================================================
-- Everyone can see the grading scales and component breakdown

CREATE POLICY "read_rubric_criteria" ON grading_rubric_criteria
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "read_grading_components" ON grading_components
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- STEP 5: SUPERVISOR RUBRIC SCORES - ROLE-BASED ACCESS
-- ============================================================

-- READ: Supervisors see only their own groups' grades
--       Coordinators see all groups in their course
--       Admins see all grades
CREATE POLICY "read_sup_rubric_supervisor" ON supervisor_rubric_scores
  FOR SELECT USING (
    -- Supervisor sees only their own group's grades
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND g.supervisor_id = auth.uid()
    )
    -- OR coordinator/admin sees any grade for their course
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
  );

-- WRITE: Only supervisor of the group or coordinator/admin can edit
CREATE POLICY "write_sup_rubric" ON supervisor_rubric_scores
  FOR ALL USING (
    graded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
  );

-- ============================================================
-- STEP 6: COMMITTEE RUBRIC SCORES - ROLE-BASED ACCESS
-- ============================================================

-- READ: Committee member sees only their own score entries or their assigned groups
--       Coordinator sees all groups in their course
CREATE POLICY "read_comm_rubric_evaluator" ON committee_rubric_scores
  FOR SELECT USING (
    -- Evaluator sees their own entries (already evaluator_id)
    evaluator_id = auth.uid()
    -- OR coordinator/admin sees any grade for their course
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
  );

-- WRITE: Only assigned evaluator or coordinator/admin can edit
CREATE POLICY "write_comm_rubric" ON committee_rubric_scores
  FOR ALL USING (
    evaluator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
  );

-- ============================================================
-- STEP 7: COORDINATOR DELIVERABLE SCORES - COURSE-LEVEL ACCESS
-- ============================================================

-- READ: Coordinator sees only their course
--       Supervisors see only their group
--       Students see only their group
CREATE POLICY "read_coord_deliverables_supervisor" ON coordinator_deliverable_scores
  FOR SELECT USING (
    -- Supervisor sees only their own group's scores
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND g.supervisor_id = auth.uid()
    )
    -- OR coordinator sees only their assigned course
    OR EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
    -- OR student sees only their own group
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id
        AND gm.student_id = auth.uid()
    )
  );

-- WRITE: Only coordinator for the course or admin
CREATE POLICY "write_coord_deliverables" ON coordinator_deliverable_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id
        AND is_coordinator_for_course(g.course_id)
    )
  );

-- ============================================================
-- STEP 8: RUBRIC CRITERIA WRITE POLICY (Coordinator/Admin Only)
-- ============================================================

CREATE POLICY "write_rubric_criteria" ON grading_rubric_criteria
  FOR ALL USING (is_coordinator_or_admin());

CREATE POLICY "write_grading_components" ON grading_components
  FOR ALL USING (is_coordinator_or_admin());

-- ============================================================
-- END OF MIGRATION
-- ============================================================
