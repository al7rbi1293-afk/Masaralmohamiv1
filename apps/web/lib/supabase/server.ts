import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceEnv } from '@/lib/env';

/**
 * Creates a Supabase client using the service role key.
 * This is the ONLY client used throughout the application.
 * All authorization is handled at the application level (middleware + lib functions).
 */
export function createSupabaseServerClient() {
  const { url, serviceRoleKey } = getSupabaseServiceEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * @deprecated Use createSupabaseServerClient() instead.
 * Kept for backward compatibility during migration.
 */
export function createSupabaseServerRlsClient() {
  return createSupabaseServerClient();
}

/**
 * @deprecated Use createSupabaseServerClient() instead.
 * Kept for backward compatibility during migration.
 */
export function createSupabaseServerAuthClient() {
  return createSupabaseServerClient();
}
