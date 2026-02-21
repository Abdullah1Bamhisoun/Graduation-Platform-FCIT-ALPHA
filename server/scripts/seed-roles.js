const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  const { data: existing, error: fetchError } = await supabaseAdmin.from('roles').select('id, name');
  if (fetchError) { console.error('Fetch error:', fetchError); process.exit(1); }
  console.log('Existing roles:', JSON.stringify(existing));

  const needed = ['admin', 'coordinator', 'supervisor', 'student'];
  const existingNames = (existing || []).map(function(r) { return r.name; });
  const missing = needed.filter(function(n) { return existingNames.indexOf(n) === -1; });
  console.log('Missing roles:', missing);

  if (missing.length > 0) {
    const rows = missing.map(function(name) { return { name: name }; });
    const { data, error } = await supabaseAdmin.from('roles').insert(rows).select();
    if (error) { console.error('Insert error:', error); process.exit(1); }
    console.log('Inserted:', JSON.stringify(data));
  } else {
    console.log('All roles already present.');
  }
}

main().catch(function(err) { console.error(err); process.exit(1); });
