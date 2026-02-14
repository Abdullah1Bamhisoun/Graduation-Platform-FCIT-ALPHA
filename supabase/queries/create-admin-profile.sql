-- STEP 1: First, get the user's UUID
-- Copy the UUID from the result and use it below

-- STEP 2: Insert the profile manually
-- Replace 'USER_UUID_HERE' with the actual UUID from Step 1
INSERT INTO profiles (id, email, name, role, department, employee_number)
VALUES (
  'USER_UUID_HERE'::uuid,  -- Replace with the actual UUID
  'coordinator@kau.edu.sa',
  'Dr. Ahmad Al-Coordinator',
  'admin',
  'CS',
  '0000195847'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  department = 'CS',
  employee_number = '0000195847';
