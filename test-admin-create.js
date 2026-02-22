const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
  const email = `test-${Date.now()}@example.com`;
  console.log("Creating user:", email);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      full_name: 'Test Assistant',
    },
  });

  if (error) {
    console.error("Auth Error:", error);
  } else {
    console.log("Success! User ID:", data.user.id);
    
    // Test if we can insert into profiles manually (if triggers don't do it)
    const { error: pErr } = await supabase.from('profiles').update({ full_name: 'Test Assistant' }).eq('user_id', data.user.id);
    if (pErr) console.error("Profile Error:", pErr);
    else console.log("Profile updated");
    
    // delete user
    await supabase.auth.admin.deleteUser(data.user.id);
    console.log("Deleted user");
  }
}

test();
