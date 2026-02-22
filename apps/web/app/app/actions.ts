'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/supabase/constants';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';

export async function signOutAction() {
  // Invalidate the session server-side first
  try {
    const supabase = createSupabaseServerAuthClient();
    await supabase.auth.signOut();
  } catch {
    // Continue with cookie cleanup even if signOut fails
  }

  const cookieStore = cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);

  redirect('/signin');
}
