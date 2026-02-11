-- Copy and paste this into Supabase SQL Editor to check if schema exists

SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'profiles'
    )
    THEN '✅ Schema exists! You can create users now.'
    ELSE '❌ Schema NOT created yet. Run STEP 1 from EXACT_SQL_STEPS.md first!'
  END as status;
