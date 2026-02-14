// Create admin user in Supabase
// Usage: cd server && npm run create-admin
//
// Set these in server/.env:
//   ADMIN_EMAIL=your@email.com
//   ADMIN_PASSWORD=yourpassword
//   ADMIN_NAME=Your Name

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in server/.env');
  console.error('Add these to your .env file:');
  console.error('  ADMIN_EMAIL=your@email.com');
  console.error('  ADMIN_PASSWORD=yourpassword');
  console.error('  ADMIN_NAME=Your Name (optional)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdminUser() {
  console.log('Creating admin user...\n');

  // Step 1: Check if admin already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

  if (existing) {
    console.log(`User ${ADMIN_EMAIL} already exists (ID: ${existing.id})`);

    // Reset password to match .env
    const { error: pwError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
    });
    if (pwError) {
      console.error('Failed to reset password:', pwError.message);
    } else {
      console.log('Password reset to match .env value.');
    }

    console.log('Ensuring profile has admin role...\n');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', existing.id)
      .single();

    if (!profile) {
      console.log('Profile missing! Creating it manually...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: existing.id,
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: 'admin',
          department: 'CS',
        });

      if (insertError) {
        console.error('Failed to create profile:', insertError.message);
        process.exit(1);
      }
      console.log('Profile created with admin role.');
    } else if (profile.role !== 'admin') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update profile role:', updateError.message);
        process.exit(1);
      }
      console.log(`Profile role updated from "${profile.role}" to "admin".`);
    } else {
      console.log('Profile already has admin role. Nothing to do.');
    }

    printSuccess(existing.id);
    return;
  }

  // Step 2: Create the auth user
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: ADMIN_NAME,
      role: 'admin',
    },
  });

  if (createError) {
    console.error('Failed to create user:', createError.message);
    process.exit(1);
  }

  const userId = user.user.id;
  console.log(`Auth user created (ID: ${userId})`);

  // Step 3: Wait briefly for the trigger to fire, then check the profile
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (!profile) {
    console.log('Trigger did not create profile. Inserting manually...');
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: 'admin',
        department: 'CS',
      });

    if (insertError) {
      console.error('Failed to create profile:', insertError.message);
      process.exit(1);
    }
  } else {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update profile:', updateError.message);
      process.exit(1);
    }
  }

  console.log('Profile set to admin role.');
  printSuccess(userId);
}

function printSuccess(userId) {
  console.log('\n--- Admin Account Ready ---');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  UUID:     ${userId}`);
  console.log(`  Role:     admin`);
}

createAdminUser().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
