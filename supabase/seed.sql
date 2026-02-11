-- =====================================================
-- GRADUATION PLATFORM FCIT - SEED DATA
-- =====================================================

-- NOTE: This seed file creates initial users for testing.
-- In production, you should create users through Supabase Auth Admin API
-- or through the application's registration flow.

-- =====================================================
-- INITIAL ADMIN USER
-- =====================================================

-- Create admin user in auth.users (you'll need to run this via Supabase Dashboard or Admin API)
-- The password hash below is for 'password123' (you should change this in production)
--
-- To create the admin user, use one of these methods:
--
-- METHOD 1: Via Supabase Dashboard
--   1. Go to Authentication > Users
--   2. Click "Add user"
--   3. Email: coordinator@kau.edu.sa
--   4. Password: password123
--   5. User Metadata: {"name": "Dr. Ahmad Al-Coordinator", "role": "admin"}
--   6. Click "Create user"
--
-- METHOD 2: Via API (using service_role key in your backend)
--   const { data, error } = await supabaseAdmin.auth.admin.createUser({
--     email: 'coordinator@kau.edu.sa',
--     password: 'password123',
--     email_confirm: true,
--     user_metadata: {
--       name: 'Dr. Ahmad Al-Coordinator',
--       role: 'admin'
--     }
--   });

-- After creating the user via Dashboard/API, update the profile with additional details
-- Replace 'USER_UUID_HERE' with the actual UUID from auth.users

-- UPDATE profiles SET
--   employee_number = '0000195847',
--   department = 'CS'
-- WHERE email = 'coordinator@kau.edu.sa';

-- =====================================================
-- SAMPLE TEST USERS (Optional - for development)
-- =====================================================

-- Test Student
-- Email: abamhisoun@stu.kau.edu.sa
-- Password: password123
-- Create via Dashboard/API with user_metadata: {"name": "Abdullah Bamhisoun", "role": "student"}
-- Then update profile:
-- UPDATE profiles SET
--   student_id = '2236500',
--   department = 'CS'
-- WHERE email = 'abamhisoun@stu.kau.edu.sa';

-- Test Supervisor
-- Email: h.labani@kau.edu.sa
-- Password: password123
-- Create via Dashboard/API with user_metadata: {"name": "Dr. Hasan Labani", "role": "supervisor"}
-- Then update profile:
-- UPDATE profiles SET
--   employee_number = '0000482731',
--   department = 'CS'
-- WHERE email = 'h.labani@kau.edu.sa';

-- =====================================================
-- SAMPLE COURSE DATA
-- =====================================================

INSERT INTO courses (code, name, term, year) VALUES
  ('CPIS_498', 'Graduation Project I', 'First Semester', 2026),
  ('CPIS_499', 'Graduation Project II', 'Second Semester', 2026);

-- =====================================================
-- INSTRUCTIONS
-- =====================================================

-- To fully seed the database:
-- 1. Run schema.sql first to create all tables
-- 2. Create users via Supabase Dashboard or Admin API (see METHOD 1/2 above)
-- 3. Run the UPDATE statements above to set additional profile fields
-- 4. The courses will be created automatically when you run this file

-- To get the UUID of a user after creation:
-- SELECT id, email FROM auth.users WHERE email = 'coordinator@kau.edu.sa';
