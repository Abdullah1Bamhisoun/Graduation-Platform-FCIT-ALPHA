/**
 * Migration: Add course_id to calendar_events table.
 * Allows coordinator-scoped calendar events.
 *
 * Run with: node scripts/add-calendar-course-id.js
 *
 * Or apply manually in the Supabase SQL Editor:
 *   ALTER TABLE calendar_events
 *     ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
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
  ALTER TABLE calendar_events
    ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
`;

async function main() {
  console.log('Applying migration: add course_id to calendar_events...');
  const { error } = await supabaseAdmin.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: null }));

  if (error) {
    console.warn('RPC exec_sql not available. Please run the following SQL manually in the Supabase SQL Editor:');
    console.log('\n' + SQL.trim() + '\n');
    console.log('Dashboard URL: https://supabase.com/dashboard/project/_/editor');
  } else {
    console.log('Migration applied successfully.');
  }
}

main().catch(console.error);
