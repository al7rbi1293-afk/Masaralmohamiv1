import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-custom';

export type CurrentAuthUser = {
  id: string;
  email: string;
};

export async function getCurrentAuthUser(): Promise<CurrentAuthUser | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const payload = verifySessionToken(sessionToken);
  if (!payload) {
    return null;
  }

  return {
    id: payload.userId,
    email: payload.email,
  };
}
