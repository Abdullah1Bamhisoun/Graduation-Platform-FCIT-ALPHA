const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  // List all public tables via information_schema
  const { data, error } = await supabaseAdmin
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (error) {
    console.error('Error listing tables:', error);
    // Try RPC instead
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('pg_tables_list');
    console.log('RPC result:', rpcData, rpcError);
    return;
  }
  console.log('Public tables:', (data || []).map(function(t) { return t.table_name; }).join(', '));
}

main().catch(function(err) { console.error(err); process.exit(1); });
