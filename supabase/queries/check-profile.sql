-- Copy and paste this into Supabase SQL Editor to check if the profile exists

-- Check if the user exists in auth.users
SELECT id, email, created_at, confirmed_at
FROM auth.users
WHERE email = 'coordinator@kau.edu.sa';

-- Check if the profile exists
SELECT id, email, name, role, department, employee_number
FROM profiles
WHERE email = 'coordinator@kau.edu.sa';
