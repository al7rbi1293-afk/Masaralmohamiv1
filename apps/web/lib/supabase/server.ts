import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { getSupabasePublicEnv, getSupabaseServiceEnv } from '@/lib/env';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';

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

export function createSupabaseServerRlsClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  // Prefer the middleware-injected header so RLS queries work even when
  // the access token gets refreshed during the same request.
  const headerStore = headers();
  const accessFromHeader = headerStore.get('x-masar-access-token')?.trim();

  const cookieStore = cookies();
  const accessFromCookie = cookieStore.get(ACCESS_COOKIE_NAME)?.value?.trim();

  const accessToken = accessFromHeader || accessFromCookie || '';

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(url, anonKey, options);
}
