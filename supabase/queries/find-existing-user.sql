-- Run this in Supabase SQL Editor to check if the user exists

-- Check auth.users table
SELECT
  id,
  email,
  created_at,
  confirmed_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'coordinator@kau.edu.sa';

-- If the user exists, check if they have a profile
SELECT
  id,
  email,
  name,
  role,
  department,
  employee_number
FROM profiles
WHERE email = 'coordinator@kau.edu.sa';
