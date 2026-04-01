import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type OfficeSessionResponse,
  fetchAdminBootstrap,
  fetchClientBootstrap,
  fetchOfficeBootstrap,
  fetchPartnerBootstrap,
  requestOfficeOtpAfterPassword as requestOfficeOtpAfterPasswordApi,
  requestOfficeOtp as requestOfficeOtpApi,
  resendOfficeActivation as resendOfficeActivationApi,
  requestClientOtp,
  signInOffice,
  startTrialRegistration as startTrialRegistrationApi,
  trySignInOffice,
  verifyOfficeOtp as verifyOfficeOtpApi,
  verifyClientOtp,
} from '../lib/api';
import { clearSession, loadSession, saveSession, type StoredSession } from '../lib/session';

const devAutoLoginEnabled = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_ENABLED?.trim().toLowerCase() === 'true';
const devAutoLoginEmail = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_EMAIL?.trim().toLowerCase() || '';

type AuthState = {
  session: StoredSession | null;
  hydrating: boolean;
  signInWithPassword: (params: {
    email: string;
    password: string;
    targetPortal?: 'office' | 'partner' | 'admin';
  }) => Promise<void>;
  startWorkforceSignIn: (params: {
    email: string;
    password: string;
    targetPortal?: 'office' | 'partner' | 'admin' | 'auto';
  }) => Promise<
    | {
        nextStep: 'signed_in';
      }
    | {
        nextStep: 'otp';
        message: string;
      }
  >;
  requestOfficeOtpAfterPassword: (params: { email: string; password: string }) => Promise<string>;
  requestOfficeOtp: (email: string) => Promise<string>;
  signInOfficeWithOtp: (params: {
    email: string;
    code: string;
    targetPortal?: 'office' | 'partner' | 'admin' | 'auto';
  }) => Promise<void>;
  requestOtp: (email: string) => Promise<string>;
  signInClientWithOtp: (params: { email: string; code: string }) => Promise<void>;
  signUpOffice: (params: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    firmName?: string;
  }) => Promise<string>;
  resendActivation: (email: string) => Promise<string>;
  switchPortal: (portal: 'office' | 'partner' | 'admin') => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function validateSession(session: StoredSession) {
  if (session.kind === 'client') {
    await fetchClientBootstrap(session.token);
    return null;
  }

  if (session.portal === 'partner') {
    await fetchPartnerBootstrap(session.token);
    return null;
  }

  if (session.portal === 'admin') {
    await fetchAdminBootstrap(session.token);
    return null;
  }

  return fetchOfficeBootstrap(session.token);
}

function resolveOfficeSession(
  payload: OfficeSessionResponse,
  targetPortal: 'office' | 'partner' | 'admin' | 'auto' = 'auto',
) {
  const resolvedPortal: StoredSession['portal'] =
    targetPortal === 'admin'
      ? 'admin'
      : targetPortal === 'partner'
        ? 'partner'
        : targetPortal === 'office'
          ? 'office'
          : payload.role.is_admin
            ? 'admin'
            : payload.role.partner_only || (!payload.role.has_office_access && payload.role.has_partner_access)
              ? 'partner'
              : 'office';

  if (targetPortal === 'partner' && resolvedPortal !== 'partner') {
    throw new Error('هذا الحساب ليس مرتبطًا ببوابة الشريك.');
  }

  if (targetPortal === 'admin' && !payload.role.is_admin) {
    throw new Error('هذا الحساب ليس مرتبطًا ببوابة الإدارة.');
  }

  const nextSession: StoredSession = {
    kind: 'office',
    portal: resolvedPortal,
    token: payload.token,
    email: payload.user.email,
    role: payload.role.name,
    orgId: payload.org?.id ?? null,
    isAdmin: payload.role.is_admin,
    hasOfficeAccess: payload.role.has_office_access,
    hasPartnerAccess: payload.role.has_partner_access,
    partnerOnly: payload.role.partner_only,
    defaultPath: payload.role.default_path,
  };

  return nextSession;
}

function isStoredDevSession(session: StoredSession) {
  if (!devAutoLoginEmail) {
    return false;
  }

  return session.email.trim().toLowerCase() === devAutoLoginEmail;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      try {
        const stored = await loadSession();
        if (!stored) {
          return;
        }

        if (!devAutoLoginEnabled && isStoredDevSession(stored)) {
          await clearSession();
          return;
        }

        const bootstrap = await validateSession(stored);
        if (stored.kind === 'office') {
          const nextSession: StoredSession = {
            ...stored,
            orgId: stored.portal === 'admin' ? stored.orgId ?? null : stored.orgId ?? bootstrap?.org?.id ?? null,
          };
          if (nextSession.orgId !== stored.orgId) {
            await saveSession(nextSession);
          }
          if (mounted) {
            setSession(nextSession);
          }
          return;
        }
        if (mounted) {
          setSession(stored);
        }
      } catch {
        await clearSession();
      } finally {
        if (mounted) {
          setHydrating(false);
        }
      }
    }

    void restore();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      hydrating,
      async signInWithPassword({ email, password, targetPortal = 'office' }) {
        const payload = await signInOffice(email, password);
        const nextSession = resolveOfficeSession(payload, targetPortal);
        await saveSession(nextSession);
        setSession(nextSession);
      },
      async startWorkforceSignIn({ email, password, targetPortal = 'auto' }) {
        const directSignIn = await trySignInOffice(email, password);

        if (directSignIn.ok) {
          const nextSession = resolveOfficeSession(directSignIn.data, targetPortal);
          await saveSession(nextSession);
          setSession(nextSession);
          return { nextStep: 'signed_in' as const };
        }

        if (directSignIn.code !== 'OTP_REQUIRED') {
          throw new Error(directSignIn.error);
        }

        const payload = await requestOfficeOtpAfterPasswordApi(email, password);
        if (payload.error) {
          throw new Error(payload.error);
        }

        return {
          nextStep: 'otp' as const,
          message: payload.message || 'تم إرسال رمز التحقق.',
        };
      },
      async requestOfficeOtpAfterPassword({ email, password }) {
        const payload = await requestOfficeOtpAfterPasswordApi(email, password);
        if (payload.error) {
          throw new Error(payload.error);
        }
        return payload.message || 'تم إرسال رمز التحقق.';
      },
      async requestOfficeOtp(email) {
        const payload = await requestOfficeOtpApi(email);
        if (payload.error) {
          throw new Error(payload.error);
        }
        return payload.message || 'تم إرسال رمز التحقق.';
      },
      async signInOfficeWithOtp({ email, code, targetPortal = 'auto' }) {
        const payload = await verifyOfficeOtpApi(email, code);
        const nextSession = resolveOfficeSession(payload, targetPortal);

        await saveSession(nextSession);
        setSession(nextSession);
      },
      async requestOtp(email) {
        const payload = await requestClientOtp(email);
        if (payload.error) {
          throw new Error(payload.error);
        }
        return payload.message || 'تم إرسال رمز التحقق.';
      },
      async signInClientWithOtp({ email, code }) {
        const payload = await verifyClientOtp(email, code);
        const nextSession: StoredSession = {
          kind: 'client',
          portal: 'client',
          token: payload.token,
          email: payload.session.email,
          role: 'client',
        };

        await saveSession(nextSession);
        setSession(nextSession);
      },
      async signUpOffice({ fullName, email, password, phone, firmName }) {
        const payload = await startTrialRegistrationApi({
          fullName,
          email,
          password,
          phone,
          firmName,
        });

        if (payload.redirectTo?.includes('pending_activation')) {
          return 'تم إنشاء الحساب وإرسال رابط التفعيل إلى بريدك الإلكتروني. فعّل البريد ثم استخدم رمز الدخول.';
        }

        return payload.message || 'تم استلام طلب التسجيل. أكمل التفعيل من البريد الإلكتروني ثم عد لتسجيل الدخول.';
      },
      async resendActivation(email) {
        const payload = await resendOfficeActivationApi(email);
        if (payload.error) {
          throw new Error(payload.error);
        }
        return payload.message || 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني.';
      },
      async switchPortal(portal) {
        if (!session || session.kind !== 'office') {
          throw new Error('هذه الجلسة لا تدعم تغيير البوابة.');
        }

        if (portal === 'admin' && !session.isAdmin) {
          throw new Error('هذا الحساب ليس مرتبطًا ببوابة الإدارة.');
        }

        if (portal === 'partner' && !session.hasPartnerAccess) {
          throw new Error('هذا الحساب ليس مرتبطًا ببوابة الشريك.');
        }

        if (portal === 'office' && !session.hasOfficeAccess) {
          throw new Error('هذا الحساب لا يملك وصولاً إلى المكتب.');
        }

        const nextSession: StoredSession = {
          ...session,
          portal,
        };
        await saveSession(nextSession);
        setSession(nextSession);
      },
      async signOut() {
        await clearSession();
        setSession(null);
      },
    }),
    [hydrating, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
