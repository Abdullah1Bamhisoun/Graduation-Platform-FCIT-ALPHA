-- =====================================================
-- QUICK REFERENCE - MOST COMMON QUERIES
-- Copy → Paste → Run in Supabase SQL Editor
-- =====================================================

-- 📋 TABLE OF CONTENTS:
-- 1. User Management
-- 2. Pending Registrations
-- 3. Courses & Groups
-- 4. Statistics
-- 5. Search & Lookup

-- =====================================================
-- 1. USER MANAGEMENT
-- =====================================================

-- Get all users (most common)
SELECT
  email,
  name,
  role,
  student_id,
  employee_number,
  department,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- Get user by email
SELECT * FROM profiles WHERE email = 'coordinator@kau.edu.sa';

-- Get UUID for a user (needed for updates)
SELECT id, email, name, role
FROM auth.users
WHERE email = 'coordinator@kau.edu.sa';

-- Update user role to admin
-- Replace USER_UUID_HERE with actual UUID
UPDATE profiles
SET role = 'admin'
WHERE id = 'USER_UUID_HERE';

-- Update student profile
UPDATE profiles
SET
  role = 'student',
  student_id = '2236500',
  department = 'CS'
WHERE id = 'USER_UUID_HERE';

-- Update supervisor profile
UPDATE profiles
SET
  role = 'supervisor',
  employee_number = '0000482731',
  department = 'CS'
WHERE id = 'USER_UUID_HERE';

-- Count users by role
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY role;

-- =====================================================
-- 2. PENDING REGISTRATIONS
-- =====================================================

-- Get all pending registrations (MOST USED)
SELECT
  id,
  name,
  email,
  account_type,
  department,
  student_id,
  employee_number,
  submitted_at
FROM pending_registrations
WHERE status = 'pending'
ORDER BY submitted_at ASC;

-- Get specific registration by email
SELECT *
FROM pending_registrations
WHERE email = 'student@example.com';

-- Count pending registrations
SELECT COUNT(*) as pending_count
FROM pending_registrations
WHERE status = 'pending';

-- Get registration by ID
SELECT *
FROM pending_registrations
WHERE id = 'REGISTRATION_UUID_HERE';

-- =====================================================
-- 3. COURSES & GROUPS
-- =====================================================

-- Get all courses
SELECT
  code,
  name,
  term,
  year,
  created_at
FROM courses
ORDER BY year DESC, code;

-- Get all groups with details
SELECT
  g.group_code,
  g.project_name,
  c.name as course_name,
  p.name as supervisor_name,
  (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
FROM groups g
LEFT JOIN courses c ON g.course_id = c.id
LEFT JOIN profiles p ON g.supervisor_id = p.id
ORDER BY g.group_code;

-- Get group by code
SELECT *
FROM groups
WHERE group_code = 'G001';

-- Get group members
SELECT
  g.group_code,
  p.name as student_name,
  p.email,
  p.student_id
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
JOIN profiles p ON gm.student_id = p.id
WHERE g.group_code = 'G001'
ORDER BY p.name;

-- Get student's group
SELECT
  g.group_code,
  g.project_name,
  c.name as course_name,
  sup.name as supervisor_name
FROM group_members gm
JOIN groups g ON gm.group_id = g.id
LEFT JOIN courses c ON g.course_id = c.id
LEFT JOIN profiles sup ON g.supervisor_id = sup.id
WHERE gm.student_id = 'USER_UUID_HERE';

-- =====================================================
-- 4. PLATFORM STATISTICS
-- =====================================================

-- Get platform overview (DASHBOARD)
SELECT
  (SELECT COUNT(*) FROM profiles WHERE role = 'student') as total_students,
  (SELECT COUNT(*) FROM profiles WHERE role = 'supervisor') as total_supervisors,
  (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as total_admins,
  (SELECT COUNT(*) FROM courses) as total_courses,
  (SELECT COUNT(*) FROM groups) as total_groups,
  (SELECT COUNT(*) FROM pending_registrations WHERE status = 'pending') as pending_registrations;

-- Students by department
SELECT
  department,
  COUNT(*) as student_count
FROM profiles
WHERE role = 'student'
GROUP BY department
ORDER BY student_count DESC;

-- Groups by course
SELECT
  c.name as course_name,
  COUNT(g.id) as group_count
FROM courses c
LEFT JOIN groups g ON c.id = g.course_id
GROUP BY c.id, c.name
ORDER BY c.name;

-- =====================================================
-- 5. SEARCH & LOOKUP
-- =====================================================

-- Find user by name (partial match)
SELECT
  email,
  name,
  role,
  student_id,
  employee_number
FROM profiles
WHERE name ILIKE '%ahmad%'
ORDER BY name;

-- Find user by student ID
SELECT *
FROM profiles
WHERE student_id = '2236500';

-- Find user by employee number
SELECT *
FROM profiles
WHERE employee_number = '0000195847';

-- Find group by project name (partial match)
SELECT
  group_code,
  project_name,
  (SELECT name FROM profiles WHERE id = supervisor_id) as supervisor
FROM groups
WHERE project_name ILIKE '%AI%'
ORDER BY group_code;

-- =====================================================
-- 6. NOTIFICATIONS & ANNOUNCEMENTS
-- =====================================================

-- Get unread notifications for a user
SELECT
  type,
  title,
  message,
  created_at
FROM notifications
WHERE user_id = 'USER_UUID_HERE'
  AND read = false
ORDER BY created_at DESC;

-- Get active announcements
SELECT
  title,
  content,
  target_roles,
  published_at
FROM announcements
WHERE (expires_at IS NULL OR expires_at > NOW())
ORDER BY published_at DESC
LIMIT 10;

-- Mark all notifications as read
UPDATE notifications
SET read = true
WHERE user_id = 'USER_UUID_HERE' AND read = false;

-- =====================================================
-- 7. MILESTONES & SUBMISSIONS
-- =====================================================

-- Get upcoming milestones
SELECT
  m.name,
  m.type,
  m.due_date,
  c.name as course_name
FROM milestones m
LEFT JOIN courses c ON m.course_id = c.id
WHERE m.due_date > NOW()
  AND m.visible = true
ORDER BY m.due_date ASC;

-- Get overdue milestones
SELECT
  m.name,
  m.type,
  m.due_date,
  c.name as course_name
FROM milestones m
LEFT JOIN courses c ON m.course_id = c.id
WHERE m.due_date < NOW()
  AND m.visible = true
ORDER BY m.due_date DESC;

-- Get submission status for a milestone
SELECT
  p.name as student_name,
  p.email,
  s.status,
  s.updated_at
FROM milestones m
LEFT JOIN submissions s ON m.id = s.milestone_id
LEFT JOIN profiles p ON s.student_id = p.id
WHERE m.id = 'MILESTONE_UUID_HERE'
ORDER BY p.name;

-- =====================================================
-- 8. HELPFUL ADMIN QUERIES
-- =====================================================

-- Check if email exists (before creating user)
SELECT
  'auth.users' as source,
  email,
  created_at
FROM auth.users
WHERE email = 'test@example.com'
UNION ALL
SELECT
  'pending_registrations' as source,
  email,
  submitted_at as created_at
FROM pending_registrations
WHERE email = 'test@example.com';

-- List all tables in database
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check RLS policies for a table
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'profiles';

-- Get database size
SELECT
  pg_size_pretty(pg_database_size(current_database())) as database_size;

-- =====================================================
-- 9. QUICK UUID LOOKUPS
-- =====================================================

-- Get UUIDs for common lookups (copy these for use in other queries)

-- User UUID by email
SELECT id, email, name FROM auth.users WHERE email = 'user@example.com';

-- Group UUID by code
SELECT id, group_code FROM groups WHERE group_code = 'G001';

-- Course UUID by code and year
SELECT id, code, name FROM courses WHERE code = 'CPIS_498' AND year = 2026;

-- Milestone UUID by name
SELECT id, name, type FROM milestones WHERE name ILIKE '%chapter%';

-- =====================================================
-- 10. TESTING / DEVELOPMENT QUERIES
-- =====================================================

-- Clear all notifications (TESTING ONLY)
-- DELETE FROM notifications;

-- Clear old notifications (older than 90 days)
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days';

-- Reset all submission statuses (TESTING ONLY)
-- UPDATE submissions SET status = 'draft';

-- Delete a test user completely (TESTING ONLY - use with caution!)
-- First get the UUID:
-- SELECT id FROM auth.users WHERE email = 'test@example.com';
-- Then delete (this cascades to profiles, submissions, etc):
-- DELETE FROM auth.users WHERE id = 'USER_UUID_HERE';
