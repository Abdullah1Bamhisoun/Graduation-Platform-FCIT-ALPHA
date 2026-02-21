const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  // Try probing known tables
  var tables = [
    'roles', 'user_roles', 'profiles', 'courses', 'groups',
    'pending_registrations', 'audit_log', 'role_switch_logs'
  ];

  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    var result = await supabaseAdmin.from(t).select('*').limit(1);
    if (result.error) {
      console.log(t + ': MISSING (' + result.error.message + ')');
    } else {
      console.log(t + ': EXISTS (sample: ' + JSON.stringify(result.data) + ')');
    }
  }
}

main().catch(function(err) { console.error(err); process.exit(1); });
