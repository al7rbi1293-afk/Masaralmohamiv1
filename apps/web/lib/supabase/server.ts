import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv, getSupabaseServiceEnv } from '@/lib/env';

export function createSupabaseServerClient() {
  const { url, serviceRoleKey } = getSupabaseServiceEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServerAuthClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
