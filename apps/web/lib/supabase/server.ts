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

import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ...

export function createSupabaseServerAuthClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
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
