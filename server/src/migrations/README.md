# Database Migration Guide

## Migration: Add Coordinator Evaluation Tables

### What This Migration Does

Creates two new tables to support the Coordinator grading functionality:

1. **`coordinator_evaluations`** - Stores raw criterion scores (1-5 scale) for coordinator evaluations
2. **`coordinator_assessments`** - Stores normalized component scores based on evaluations

Both tables include Row Level Security (RLS) policies to ensure coordinators can only see/edit their own evaluations.

### How to Apply This Migration

#### Option 1: Using Supabase Dashboard (Recommended for Development)

1. **Log in to Supabase**
   - Go to https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste Migration SQL**
   - Open `/server/src/migrations/001_coordinator_evaluations.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Execute**
   - Click the "▶ Run" button (or press Cmd+Enter / Ctrl+Enter)
   - Wait for success message

5. **Verify**
   - Check the output shows "CREATE TABLE" for both tables
   - No error messages should appear

#### Option 2: Using Supabase CLI (Recommended for Production)

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link Your Project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Create and Apply Migration**
   ```bash
   # Copy migration to your Supabase migrations folder
   cp server/src/migrations/001_coordinator_evaluations.sql supabase/migrations/

   # Push migrations to database
   supabase push
   ```

### What Each Table Does

#### Table 1: `coordinator_evaluations`

Stores **raw scores** (1-5) for each criterion when coordinators evaluate groups.

**Key Columns:**
- `group_id` - Which group is being evaluated
- `coordinator_id` - Which coordinator submitted the evaluation
- `criterion_id` - Which rubric criterion is being scored
- `raw_score` - Score from 1-5
- `submission_status` - "draft" (in progress) or "submitted" (final)

**Uniqueness:** One row per (group, coordinator, criterion)

#### Table 2: `coordinator_assessments`

Stores **normalized scores** (scaled to component weight) calculated from raw criterion scores.

**Key Columns:**
- `group_id` - Which group is being evaluated
- `coordinator_id` - Which coordinator submitted the evaluation
- `component_key` - Grade component being scored (e.g., 'coordinator_eval')
- `normalized_score` - Final score after normalization formula
- `max_score` - Maximum possible score for this component
- `submission_status` - "draft" or "submitted"

**Uniqueness:** One row per (group, coordinator, component)

### RLS (Row Level Security) Policies

Both tables have identical RLS policies:

- **SELECT**: Coordinators see only their own evaluations; Admins see all
- **INSERT**: Coordinators can only insert their evaluation records
- **UPDATE**: Coordinators can only update their own records
- **DELETE**: Coordinators can only delete their own records

### Verification Checklist

After running the migration, verify:

1. **Tables Created**
   ```sql
   SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('coordinator_evaluations', 'coordinator_assessments');
   ```
   Should return 2 rows.

2. **RLS Enabled**
   ```sql
   SELECT tablename, pg_class.relrowsecurity
     FROM pg_class JOIN pg_tables ON pg_class.relname = pg_tables.tablename
     WHERE tablename IN ('coordinator_evaluations', 'coordinator_assessments');
   ```
   Should show `relrowsecurity = true` for both.

3. **Policies Exist**
   ```sql
   SELECT schemaname, tablename, policyname FROM pg_policies
     WHERE tablename IN ('coordinator_evaluations', 'coordinator_assessments');
   ```
   Should return 8 rows total (4 policies per table).

### Rollback (If Needed)

If you need to undo this migration:

```sql
-- Drop RLS policies
DROP POLICY IF EXISTS "Coordinators see own evals, Admin sees all" ON coordinator_evaluations;
DROP POLICY IF EXISTS "Coordinators insert own evals" ON coordinator_evaluations;
DROP POLICY IF EXISTS "Coordinators update own evals" ON coordinator_evaluations;
DROP POLICY IF EXISTS "Coordinators delete own evals" ON coordinator_evaluations;

DROP POLICY IF EXISTS "Coordinators see own assessments, Admin sees all" ON coordinator_assessments;
DROP POLICY IF EXISTS "Coordinators insert own assessments" ON coordinator_assessments;
DROP POLICY IF EXISTS "Coordinators update own assessments" ON coordinator_assessments;
DROP POLICY IF EXISTS "Coordinators delete own assessments" ON coordinator_assessments;

-- Drop tables
DROP TABLE IF EXISTS coordinator_assessments CASCADE;
DROP TABLE IF EXISTS coordinator_evaluations CASCADE;
```

### Notes

- The migration uses `IF NOT EXISTS` to be idempotent (safe to run multiple times)
- Foreign keys reference `grading_rubric_criteria` - ensure criteria exist before inserting
- The `ON DELETE RESTRICT` on `criterion_id` prevents accidental criterion deletion while evaluations exist
- Timeline fields (`created_at`, `updated_at`) are set to NOW() on insert, should be updated manually on record changes

### Next Steps

After running this migration:

1. Backend API endpoints will use these tables to store coordinator evaluations
2. Frontend will display evaluation forms based on `coordinator_eval` rubric criteria
3. Score normalization will happen in the backend before storing in `coordinator_assessments`

---

**Questions?** Check the implementation comments in the SQL file or review the Plan document at `/workspace/.claude/plans/glittery-dazzling-yao.md`
