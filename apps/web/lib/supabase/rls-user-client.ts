import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { getSupabaseJwtSecret, getSupabasePublicEnv } from '@/lib/env';

export async function createSupabaseRlsUserClient(userId: string): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabasePublicEnv();
  const jwtSecret = getSupabaseJwtSecret();

  const token = await new SignJWT({
    role: 'authenticated',
    aud: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(jwtSecret));

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
