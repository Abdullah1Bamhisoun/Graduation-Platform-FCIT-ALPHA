// Run this script to create the admin user
// Usage: node create-admin.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env variables from server/.env
const envFile = readFileSync('./server/.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && !line.startsWith('#')) {
    envVars[key.trim()] = values.join('=').trim();
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  console.log('🔄 Creating admin user...');

  try {
    // Create the user
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: 'coordinator@kau.edu.sa',
      password: 'password123',
      email_confirm: true,
      user_metadata: {
        name: 'Dr. Ahmad Al-Coordinator',
        role: 'admin'
      }
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      return;
    }

    console.log('✅ User created:', user.user.id);
    console.log('📧 Email:', user.user.email);

    // Update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        employee_number: '0000195847',
        department: 'CS'
      })
      .eq('id', user.user.id);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError.message);
      return;
    }

    console.log('✅ Profile updated successfully!');
    console.log('\n🎉 Admin user created:');
    console.log('   Email: coordinator@kau.edu.sa');
    console.log('   Password: password123');
    console.log('   UUID:', user.user.id);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

createAdminUser();
