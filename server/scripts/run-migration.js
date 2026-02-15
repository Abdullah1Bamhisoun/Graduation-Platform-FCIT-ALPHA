/**
 * Applies the migration via Supabase Management API.
 * Run with: node scripts/run-migration.js
 */
require('dotenv').config();
const https = require('https');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

if (!serviceRoleKey || !supabaseUrl) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Extract project ref from URL: https://XXXX.supabase.co
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

const statements = [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'))`,
  `ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_number INTEGER CHECK (group_number BETWEEN 1 AND 50)`,
  `ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`,
  `ALTER TABLE groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))`,
  `ALTER TABLE groups ADD COLUMN IF NOT EXISTS department TEXT CHECK (department IN ('CS', 'IT', 'IS'))`,
  `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'))`,
  `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS group_number INTEGER`,
];

function runSql(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: `db.${projectRef}.supabase.co`,
      path: `/rest/v1/rpc/exec`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Project ref:', projectRef);
  console.log('Applying migration...\n');

  let anyFailed = false;
  for (const sql of statements) {
    process.stdout.write(`  ${sql.slice(0, 70)}... `);
    const result = await runSql(sql).catch((e) => ({ status: 0, body: e.message }));
    if (result.status >= 200 && result.status < 300) {
      console.log('OK');
    } else {
      console.log(`FAILED (${result.status}): ${result.body.slice(0, 120)}`);
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.log('\nSome statements could not run automatically.');
    console.log('Please run the following SQL in the Supabase SQL Editor at:');
    console.log(`  https://supabase.com/dashboard/project/${projectRef}/editor\n`);
    statements.forEach((s) => console.log(s + ';'));
  } else {
    console.log('\nMigration applied successfully!');
  }
}

main().catch(console.error);
