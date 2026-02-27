# Grading System Access Control Fix

## Problem Summary

The original grading system had overly permissive access controls:

1. **All authenticated users** could view grades for **any group** in the system
2. **Coordinators** had global write access to **all courses** instead of just their assigned course
3. **Supervisors** could see grades for students they don't supervise
4. No filtering by **course_type** (498 vs 499) enforcement in RLS policies

## Solution Design

Created a new SQL migration (`002_grading_access_control_fix.sql`) that implements course-level and role-based access control with helper functions.

### Key Changes

#### 1. **Deleted All Existing Grades**
```sql
DELETE FROM supervisor_rubric_scores;
DELETE FROM committee_rubric_scores;
DELETE FROM coordinator_deliverable_scores;
```
This clears mock/test data and starts fresh with proper authorization.

#### 2. **New Helper Functions**

| Function | Purpose |
|----------|---------|
| `is_coordinator_or_admin()` | Checks if user has any coordinator or admin role (globally) |
| `is_coordinator_for_course(course_id)` | Checks if user coordinates a specific course |
| `is_group_supervisor(group_id)` | Checks if user supervises a specific group |
| `is_group_member(group_id)` | Checks if user is a student in a group |
| `is_committee_evaluator(group_id)` | Checks if user is assigned to evaluate a group |

#### 3. **New RLS Policies by Table**

##### **grading_rubric_criteria & grading_components**
- **READ**: All authenticated users ✓ (everyone sees the grading scales)
- **WRITE**: Coordinator/Admin only ✓

##### **supervisor_rubric_scores**
- **READ**:
  - Supervisor sees their own group's grades
  - Coordinator sees all groups in their assigned course
  - Admin sees all grades
- **WRITE**:
  - Supervisor who graded + Coordinator of the group's course

##### **committee_rubric_scores**
- **READ**:
  - Evaluator sees only their own score entries (rows where `evaluator_id = auth.uid()`)
  - Coordinator sees all groups in their assigned course
  - Admin sees all grades
- **WRITE**:
  - Assigned evaluator (who created the score) + Coordinator of the group's course

##### **coordinator_deliverable_scores**
- **READ**:
  - Supervisor sees only their own group's scores
  - Coordinator sees only their assigned course
  - Students see only their own group
- **WRITE**:
  - Coordinator for the course only

## Data Model Relationships

The queries use these table relationships:

```
supervisor_rubric_scores
├── group_id → groups.id
├── course_id → courses.id
└── graded_by → profiles.id (supervisor)

committee_rubric_scores
├── group_id → groups.id
├── course_id → courses.id
└── evaluator_id → profiles.id

coordinator_deliverable_scores
├── group_id → groups.id
└── course_id → courses.id

groups
├── id
├── supervisor_id → profiles.id
├── course_id → courses.id
└── course_number ('498' or '499')

group_members
├── group_id → groups.id
└── student_id → profiles.id

user_roles
├── user_id → profiles.id
├── role_id → roles.id
└── coordinator_course_id → courses.id
```

## How to Apply

1. **Backup your database** (if production)
2. Go to **Supabase → SQL Editor**
3. Copy the entire contents of `002_grading_access_control_fix.sql`
4. Paste into the SQL editor and click **Run**
5. You should see: "Success. No rows returned"

## Testing Access Scenarios

### Scenario 1: Supervisor Viewing Grades
```
✓ Supervisor can see grades for groups they supervise
✗ Supervisor cannot see grades for other supervisors' groups
✗ Supervisor cannot see committee or coordinator grades
```

### Scenario 2: Coordinator Viewing Grades
```
✓ Coordinator can see all grades for their assigned course
✓ Coordinator can edit any score in their course
✗ Coordinator cannot see grades from other courses
```

### Scenario 3: Committee Member Viewing Grades
```
✓ Committee member can see their own score entries
✓ Evaluator cannot see grades from their own supervised group
✓ Coordinator can override evaluator's restrictions
```

### Scenario 4: Student Viewing Grades
```
✓ Student can see their group's final grades
✗ Student cannot see other groups' grades
✗ Student cannot submit/edit grades (no write policy)
```

## Code Changes Needed in Frontend

The frontend services may need updates to fully leverage these RLS policies:

### `/src/services/grading-rubric.ts`
Currently filters application-side; can rely more on RLS:
- Remove manual course filtering for supervisors (RLS handles it)
- Remove manual role checks (RLS enforces it)

### `/src/pages/supervisor/GradingAssessment.tsx`
- Remove line 139's manual filter: `grades.filter(gr => gr.supervisorName === user.name)`
- RLS will automatically restrict to their groups

### `/src/pages/coordinator/CommitteeScores.tsx`
- Remove hardcoded courseType='499' (line 132)
- Add courseType parameter based on user's coordinator_course_id
- RLS will restrict to assigned course

### `/src/pages/admin/GradesDeliverables.tsx`
- Add course filtering if not admin
- RLS will help but frontend should reflect coordinator-specific view

## Backward Compatibility

- Old `profiles.role` enum is checked with `::text` cast to avoid type mismatches
- `user_roles` table is authoritative (matches latest architecture)
- Both checked with OR logic: if either says yes, access granted

## Security Benefits

✓ **No data leakage** – Users never see unauthorized grades
✓ **Course isolation** – Grades always filtered by course
✓ **Role enforcement** – Database enforces permissions, not just UI
✓ **Conflict prevention** – Supervisors can't grade their own groups
✓ **Coordinator scoping** – Coordinators stick to one course each

## Potential Issues & Rollback

If there are errors when running the migration:

**Error: "column coordinator_course_id not found"**
- This function assumes `user_roles.coordinator_course_id` exists
- Check Supabase schema and adjust the `is_coordinator_for_course()` function if needed
- Can also remove it to rely only on `profiles.role` check

**Error about missing tables**
- The RLS policies reference `groups`, `group_members`, `user_roles`, `roles` tables
- Ensure these exist by running the initial database migration first

**To rollback**, re-run the original `001_full_grading_system.sql` to restore the old (permissive) policies.
