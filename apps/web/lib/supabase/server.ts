import 'server-only';

import { createClient } from '@supabase/supabase-js';

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

export function createSupabaseServerClient() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = required('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServerAuthClient() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
