'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/supabase/constants';

export async function signOutAction() {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);

  redirect('/signin');
}
