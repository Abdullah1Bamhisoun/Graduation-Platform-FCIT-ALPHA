-- =====================================================
-- GRADUATION PLATFORM FCIT - USEFUL SQL QUERIES
-- =====================================================

-- =====================================================
-- USER MANAGEMENT QUERIES
-- =====================================================

-- Get all users with their roles
SELECT
  id,
  email,
  name,
  role,
  student_id,
  employee_number,
  department,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- Get all pending registrations
SELECT
  id,
  account_type,
  name,
  email,
  department,
  student_id,
  employee_number,
  status,
  submitted_at
FROM pending_registrations
WHERE status = 'pending'
ORDER BY submitted_at ASC;

-- Get user by email
SELECT * FROM profiles WHERE email = 'coordinator@kau.edu.sa';

-- Update user role
UPDATE profiles
SET role = 'admin'
WHERE email = 'coordinator@kau.edu.sa';

-- =====================================================
-- COURSE & GROUP QUERIES
-- =====================================================

-- Get all courses with enrollment counts
SELECT
  c.id,
  c.code,
  c.name,
  c.term,
  c.year,
  COUNT(DISTINCT g.id) as group_count,
  COUNT(DISTINCT gm.student_id) as student_count
FROM courses c
LEFT JOIN groups g ON c.id = g.course_id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY c.id
ORDER BY c.year DESC, c.code;

-- Get all groups with their members and supervisor
SELECT
  g.id,
  g.group_code,
  g.project_name,
  c.code as course_code,
  c.name as course_name,
  p_sup.name as supervisor_name,
  COUNT(gm.student_id) as member_count
FROM groups g
LEFT JOIN courses c ON g.course_id = c.id
LEFT JOIN profiles p_sup ON g.supervisor_id = p_sup.id
LEFT JOIN group_members gm ON g.id = gm.group_id
GROUP BY g.id, g.group_code, g.project_name, c.code, c.name, p_sup.name
ORDER BY g.group_code;

-- Get group members with details
SELECT
  g.group_code,
  g.project_name,
  p.name as student_name,
  p.email,
  p.student_id,
  gm.joined_at
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
JOIN profiles p ON gm.student_id = p.id
WHERE g.group_code = 'G001'
ORDER BY p.name;

-- =====================================================
-- MILESTONE & SUBMISSION QUERIES
-- =====================================================

-- Get all milestones with submission counts
SELECT
  m.id,
  m.name,
  m.type,
  c.code as course_code,
  m.due_date,
  m.visible,
  COUNT(s.id) as submission_count,
  COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as submitted_count,
  COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved_count
FROM milestones m
LEFT JOIN courses c ON m.course_id = c.id
LEFT JOIN submissions s ON m.id = s.milestone_id
GROUP BY m.id, m.name, m.type, c.code, m.due_date, m.visible
ORDER BY m.due_date DESC;

-- Get student submissions with status
SELECT
  m.name as milestone_name,
  m.type,
  m.due_date,
  s.status,
  s.current_version,
  s.updated_at,
  CASE
    WHEN s.updated_at > m.due_date THEN 'Late'
    ELSE 'On Time'
  END as submission_timing
FROM milestones m
LEFT JOIN submissions s ON m.id = s.milestone_id
WHERE s.student_id = 'USER_UUID_HERE'
ORDER BY m.due_date DESC;

-- Get submission with all versions
SELECT
  sv.version,
  sv.file_name,
  sv.file_size,
  sv.notes,
  sv.uploaded_at
FROM submission_versions sv
WHERE sv.submission_id = 'SUBMISSION_UUID_HERE'
ORDER BY sv.version DESC;

-- Get submission with feedback
SELECT
  m.name as milestone_name,
  s.status,
  sf.total_score,
  sf.max_score,
  sf.overall_comment,
  p.name as reviewer_name,
  sf.reviewed_at
FROM submissions s
JOIN milestones m ON s.milestone_id = m.id
LEFT JOIN submission_feedback sf ON s.id = sf.submission_id
LEFT JOIN profiles p ON sf.reviewed_by = p.id
WHERE s.student_id = 'USER_UUID_HERE'
ORDER BY sf.reviewed_at DESC;

-- =====================================================
-- GRADING QUERIES
-- =====================================================

-- Get student's complete grade breakdown
SELECT
  p.name as student_name,
  p.student_id,
  g.group_code,
  -- Group deliverables (40 marks)
  COALESCE(SUM(CASE WHEN gdg.deliverable_key LIKE 'chapter%' THEN gdg.score ELSE 0 END), 0) as chapters_score,
  COALESCE(SUM(CASE WHEN gdg.deliverable_key = 'finalReport' THEN gdg.score ELSE 0 END), 0) as final_report_score,
  -- Supervisor assessment (20 marks)
  COALESCE(sa.score, 0) as supervisor_score,
  -- Committee evaluation (40 marks)
  COALESCE(AVG(ce.score), 0) as committee_avg_score,
  -- Peer evaluation (5 marks)
  COALESCE(AVG(pe.score), 0) as peer_avg_score,
  -- Total
  COALESCE(SUM(CASE WHEN gdg.deliverable_key LIKE 'chapter%' THEN gdg.score ELSE 0 END), 0) +
  COALESCE(SUM(CASE WHEN gdg.deliverable_key = 'finalReport' THEN gdg.score ELSE 0 END), 0) +
  COALESCE(sa.score, 0) +
  COALESCE(AVG(ce.score), 0) +
  COALESCE(AVG(pe.score), 0) as total_score
FROM profiles p
LEFT JOIN group_members gm ON p.id = gm.student_id
LEFT JOIN groups g ON gm.group_id = g.id
LEFT JOIN group_deliverable_grades gdg ON g.id = gdg.group_id
LEFT JOIN supervisor_assessments sa ON p.id = sa.student_id AND g.id = sa.group_id
LEFT JOIN committee_evaluations ce ON p.id = ce.student_id AND g.id = ce.group_id
LEFT JOIN peer_evaluations pe ON p.id = pe.student_id AND g.id = pe.group_id
WHERE p.role = 'student' AND p.student_id = '2236500'
GROUP BY p.id, p.name, p.student_id, g.group_code, sa.score;

-- Get all students grades for a course
SELECT
  p.name,
  p.student_id,
  g.group_code,
  COALESCE(SUM(gdg.score), 0) as deliverables_total,
  COALESCE(sa.score, 0) as supervisor_score,
  COALESCE(AVG(ce.score), 0) as committee_score,
  COALESCE(AVG(pe.score), 0) as peer_score
FROM profiles p
JOIN group_members gm ON p.id = gm.student_id
JOIN groups g ON gm.group_id = g.id
JOIN courses c ON g.course_id = c.id
LEFT JOIN group_deliverable_grades gdg ON g.id = gdg.group_id AND c.id = gdg.course_id
LEFT JOIN supervisor_assessments sa ON p.id = sa.student_id AND g.id = sa.group_id AND c.id = sa.course_id
LEFT JOIN committee_evaluations ce ON p.id = ce.student_id AND g.id = ce.group_id AND c.id = ce.course_id
LEFT JOIN peer_evaluations pe ON p.id = pe.student_id AND g.id = pe.group_id AND c.id = pe.course_id
WHERE c.code = 'CPIS_498' AND c.year = 2026
GROUP BY p.id, p.name, p.student_id, g.group_code, sa.score
ORDER BY p.student_id;

-- =====================================================
-- WEEKLY REPORTS QUERIES
-- =====================================================

-- Get all weekly reports for a group
SELECT
  wr.week_number,
  wr.date_range,
  wr.progress_status,
  wr.all_members_attended,
  wr.absent_student_name,
  wr.supervisor_comments,
  p.name as reviewer_name,
  wr.submitted_at
FROM weekly_reports wr
LEFT JOIN profiles p ON wr.reviewed_by = p.id
WHERE wr.group_id = 'GROUP_UUID_HERE'
ORDER BY wr.week_number DESC;

-- Get weekly reports summary for all groups
SELECT
  g.group_code,
  g.project_name,
  COUNT(wr.id) as total_reports,
  SUM(CASE WHEN wr.progress_status = 'excellent' THEN 1 ELSE 0 END) as excellent_count,
  SUM(CASE WHEN wr.progress_status = 'good' THEN 1 ELSE 0 END) as good_count,
  SUM(CASE WHEN wr.progress_status = 'needs_improvement' THEN 1 ELSE 0 END) as needs_improvement_count
FROM groups g
LEFT JOIN weekly_reports wr ON g.id = wr.group_id
GROUP BY g.id, g.group_code, g.project_name
ORDER BY g.group_code;

-- =====================================================
-- ANNOUNCEMENTS & NOTIFICATIONS QUERIES
-- =====================================================

-- Get active announcements for a role
SELECT
  a.title,
  a.content,
  p.name as author_name,
  a.published_at,
  a.expires_at
FROM announcements a
LEFT JOIN profiles p ON a.author_id = p.id
WHERE 'student' = ANY(a.target_roles)
  AND (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY a.published_at DESC;

-- Get unread notifications for a user
SELECT
  n.type,
  n.title,
  n.message,
  n.link,
  n.created_at
FROM notifications n
WHERE n.user_id = 'USER_UUID_HERE'
  AND n.read = false
ORDER BY n.created_at DESC;

-- Mark all notifications as read for a user
UPDATE notifications
SET read = true
WHERE user_id = 'USER_UUID_HERE' AND read = false;

-- =====================================================
-- PRESENTATION SCHEDULES QUERIES
-- =====================================================

-- Get all presentation schedules with group details
SELECT
  ps.day,
  ps.time_slot,
  g.group_code,
  g.project_name,
  p.name as supervisor_name,
  ps.committee_members
FROM presentation_schedules ps
JOIN groups g ON ps.group_id = g.id
LEFT JOIN profiles p ON g.supervisor_id = p.id
ORDER BY ps.day, ps.time_slot;

-- =====================================================
-- AUDIT LOG QUERIES
-- =====================================================

-- Get recent audit log entries
SELECT
  al.timestamp,
  p.name as actor_name,
  p.email as actor_email,
  al.action,
  al.entity,
  al.context
FROM audit_log al
LEFT JOIN profiles p ON al.actor_id = p.id
ORDER BY al.timestamp DESC
LIMIT 50;

-- Get audit log for specific user
SELECT
  al.timestamp,
  al.action,
  al.entity,
  al.context
FROM audit_log al
WHERE al.actor_id = 'USER_UUID_HERE'
ORDER BY al.timestamp DESC;

-- =====================================================
-- STATISTICS & ANALYTICS QUERIES
-- =====================================================

-- Platform overview statistics
SELECT
  (SELECT COUNT(*) FROM profiles WHERE role = 'student') as total_students,
  (SELECT COUNT(*) FROM profiles WHERE role = 'supervisor') as total_supervisors,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as total_admins,
  (SELECT COUNT(*) FROM courses) as total_courses,
  (SELECT COUNT(*) FROM groups) as total_groups,
  (SELECT COUNT(*) FROM milestones) as total_milestones,
  (SELECT COUNT(*) FROM submissions WHERE status = 'submitted') as total_submissions,
  (SELECT COUNT(*) FROM pending_registrations WHERE status = 'pending') as pending_registrations;

-- Submission statistics by milestone type
SELECT
  m.type,
  COUNT(s.id) as total_submissions,
  COUNT(CASE WHEN s.status = 'draft' THEN 1 END) as drafts,
  COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as submitted,
  COUNT(CASE WHEN s.status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN s.status = 'changes_requested' THEN 1 END) as changes_requested
FROM milestones m
LEFT JOIN submissions s ON m.id = s.milestone_id
GROUP BY m.type
ORDER BY m.type;

-- =====================================================
-- HELPER QUERIES FOR TESTING
-- =====================================================

-- Get UUID for a user by email (useful for copying UUIDs)
SELECT id, email, name, role FROM auth.users WHERE email = 'coordinator@kau.edu.sa';

-- Get UUID for a group by group code
SELECT id, group_code, project_name FROM groups WHERE group_code = 'G001';

-- Get UUID for a submission
SELECT s.id, m.name as milestone_name, p.name as student_name
FROM submissions s
JOIN milestones m ON s.milestone_id = m.id
JOIN profiles p ON s.student_id = p.id
WHERE p.email = 'student@example.com';

-- =====================================================
-- CLEANUP QUERIES (USE WITH CAUTION!)
-- =====================================================

-- Delete all notifications older than 90 days
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days';

-- Delete expired announcements
-- DELETE FROM announcements WHERE expires_at < NOW();

-- Reset all submission statuses to draft (TESTING ONLY)
-- UPDATE submissions SET status = 'draft';
