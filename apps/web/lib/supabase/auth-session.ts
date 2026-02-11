import { cookies } from 'next/headers';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/supabase/constants';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';

export type CurrentAuthUser = {
  id: string;
  email: string;
};

export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const authClient = createSupabaseServerAuthClient();

  if (accessToken) {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (!error && data.user?.email) {
      return { id: data.user.id, email: data.user.email };
    }
  }

  if (!refreshToken) {
    return null;
  }

  const { data: refreshed, error: refreshError } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshError || !refreshed.session) {
    return null;
  }

  const { data: refreshedUser, error: refreshedUserError } = await authClient.auth.getUser(
    refreshed.session.access_token,
  );

  if (refreshedUserError || !refreshedUser.user?.email) {
    return null;
  }

  return {
    id: refreshedUser.user.id,
    email: refreshedUser.user.email,
  };
}
