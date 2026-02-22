'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME } from '@/lib/auth-custom';

export async function signOutAction() {
  const cookieStore = cookies();

  // Clear custom JWT session cookie
  cookieStore.delete(SESSION_COOKIE_NAME);
  // Clear old Supabase cookies (in case they linger)
  cookieStore.delete('masar-sb-access-token');
  cookieStore.delete('masar-sb-refresh-token');

  redirect('/signin');
}
