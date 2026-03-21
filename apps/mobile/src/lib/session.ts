import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'masar_mobile_session_v1';

export type StoredSession = {
  kind: 'office' | 'client';
  portal: 'office' | 'client' | 'partner' | 'admin';
  token: string;
  email: string;
  role?: string | null;
  orgId?: string | null;
  isAdmin?: boolean;
  hasOfficeAccess?: boolean;
  hasPartnerAccess?: boolean;
  partnerOnly?: boolean;
  defaultPath?: string | null;
};

export async function saveSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
