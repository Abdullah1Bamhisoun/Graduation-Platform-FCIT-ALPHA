/**
 * Migration: Create the calendar_events table (if it does not already exist).
 *
 * Run with: node scripts/create-calendar-events-table.js
 *
 * Or apply the SQL manually in the Supabase SQL Editor:
 *   https://supabase.com/dashboard/project/_/editor
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SQL = `
  CREATE TABLE IF NOT EXISTS public.calendar_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text        NOT NULL,
    date        date        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('deadline', 'demo', 'presentation', 'meeting')),
    time        text,
    location    text,
    course_id   uuid        REFERENCES public.courses(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  -- Enable RLS (rows are read/written via the service-role key on the backend,
  -- so no additional row-level policies are required for the API to function)
  ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

  -- Allow authenticated users to read all calendar events
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'calendar_events' AND policyname = 'calendar_events_read'
    ) THEN
      CREATE POLICY "calendar_events_read"
        ON public.calendar_events
        FOR SELECT
        USING (auth.role() = 'authenticated');
    END IF;
  END $$;
`;

async function main() {
  console.log('Applying migration: create calendar_events table...\n');

  const { error } = await supabaseAdmin.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: null }));

  if (error) {
    console.warn('RPC exec_sql not available. Please run the following SQL manually in the Supabase SQL Editor:');
    console.warn('  https://supabase.com/dashboard/project/_/editor\n');
    console.log(SQL.trim());
  } else {
    console.log('Migration applied successfully (or table already existed).');
  }
}

main().catch(console.error);
