/**
 * Creates the roles and user_roles tables in Supabase, then seeds the four role names.
 * Run with: node scripts/create-roles-tables.js
 */
require('dotenv').config();
const https = require('https');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

if (!serviceRoleKey || !supabaseUrl) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

const statements = [
  // Create roles lookup table
  `CREATE TABLE IF NOT EXISTS public.roles (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
  )`,

  // Seed the four role names
  `INSERT INTO public.roles (name) VALUES ('admin'), ('coordinator'), ('supervisor'), ('student')
   ON CONFLICT (name) DO NOTHING`,

  // Create user_roles join table
  `CREATE TABLE IF NOT EXISTS public.user_roles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id               UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    coordinator_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    UNIQUE (user_id, role_id)
  )`,

  // Enable RLS on both tables
  `ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY`,

  // Allow service role to read roles (needed for PostgREST schema cache)
  `GRANT SELECT ON public.roles TO service_role, authenticated, anon`,
  `GRANT ALL ON public.user_roles TO service_role`,
  `GRANT SELECT ON public.user_roles TO authenticated`,
];

function runSql(sql) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ query: sql });
    var options = {
      hostname: 'db.' + projectRef + '.supabase.co',
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': 'Bearer ' + serviceRoleKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Project ref:', projectRef);
  console.log('Creating roles and user_roles tables...\n');

  var failed = [];
  for (var i = 0; i < statements.length; i++) {
    var sql = statements[i];
    process.stdout.write('  ' + sql.trim().slice(0, 70) + '... ');
    var result = await runSql(sql).catch(function(e) { return { status: 0, body: e.message }; });
    if (result.status >= 200 && result.status < 300) {
      console.log('OK');
    } else {
      console.log('FAILED (' + result.status + '): ' + result.body.slice(0, 120));
      failed.push(sql);
    }
  }

  if (failed.length > 0) {
    console.log('\nSome statements failed. Please run manually in Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/' + projectRef + '/editor\n');
    failed.forEach(function(s) { console.log(s + ';\n'); });
  } else {
    console.log('\nDone! roles and user_roles tables created and seeded.');
  }
}

main().catch(console.error);
