-- Complete Admin Creation Script
-- This creates the auth user AND profile in one go

-- IMPORTANT: Run this in Supabase SQL Editor

-- First, disable the trigger temporarily to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the auth user directly
-- Note: This requires service_role privileges
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'coordinator@kau.edu.sa',
  crypt('password123', gen_salt('bf')),  -- Hashed password
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Dr. Ahmad Al-Coordinator","role":"admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Now create the profile for this user
-- First, get the user's ID
WITH user_id AS (
  SELECT id FROM auth.users WHERE email = 'coordinator@kau.edu.sa'
)
INSERT INTO profiles (id, email, name, role, department, employee_number)
SELECT
  user_id.id,
  'coordinator@kau.edu.sa',
  'Dr. Ahmad Al-Coordinator',
  'admin',
  'CS',
  '0000195847'
FROM user_id
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  department = 'CS',
  employee_number = '0000195847',
  name = 'Dr. Ahmad Al-Coordinator';

-- Re-enable the trigger for future users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the user was created
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.department,
  p.employee_number
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'coordinator@kau.edu.sa';
