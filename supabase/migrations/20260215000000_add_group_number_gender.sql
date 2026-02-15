-- =====================================================
-- MIGRATION: Add group_number, is_locked, status,
--            department to groups table;
--            gender to profiles and pending_registrations
-- =====================================================

-- 1. Add gender column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- 2. Add group_number, is_locked, status, department to groups
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS group_number INTEGER CHECK (group_number BETWEEN 1 AND 50),
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status registration_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS department department_type;

-- Unique constraint on group_number per department
CREATE UNIQUE INDEX IF NOT EXISTS groups_group_number_department_idx
  ON groups (group_number, department)
  WHERE group_number IS NOT NULL AND department IS NOT NULL;

-- 3. Add gender + group_number to pending_registrations
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS group_number INTEGER;
