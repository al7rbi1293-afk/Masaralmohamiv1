export type SessionUser = {
  id: string;
  tenantId: string;
  email: string;
  role: 'PARTNER' | 'LAWYER' | 'ASSISTANT';
  name: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

const SESSION_KEY = 'masar_auth_session_v1';

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}
