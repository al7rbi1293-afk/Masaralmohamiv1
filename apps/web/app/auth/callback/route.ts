import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = toEmailOtpType(searchParams.get('type'));
  const nextPath = safeNextPath(searchParams.get('next')) ?? '/app';

  const supabase = createSupabaseServerAuthClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      return await withSessionRedirect(origin, nextPath, data.session);
    }
  }

  if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (!error && data.session) {
      return await withSessionRedirect(origin, nextPath, data.session);
    }
  }

  return NextResponse.redirect(
    `${origin}/signin?error=${encodeURIComponent('رابط التفعيل غير صالح أو منتهي. اطلب رابطًا جديدًا أو سجّل الدخول.')}`,
  );
}

async function withSessionRedirect(origin: string, nextPath: string, session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    user_metadata?: Record<string, unknown>;
  };
}) {
  let destination = nextPath;

  // For normal app activation flows, bootstrap org+trial if missing.
  if (nextPath.startsWith('/app') && !nextPath.startsWith('/app/api')) {
    try {
      const firmName = typeof session.user.user_metadata?.firm_name === 'string'
        ? session.user.user_metadata.firm_name
        : null;
      const provision = await ensureTrialProvisionForUser({
        userId: session.user.id,
        firmName,
      });
      if (provision.isExpired && !nextPath.startsWith('/app/expired')) {
        destination = '/app/expired';
      }
    } catch {
      // Keep login working; dashboard can still guide user if trial bootstrap fails.
      destination = '/app';
    }
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.set(ACCESS_COOKIE_NAME, session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

function toEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }

  if (
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change' ||
    value === 'email'
  ) {
    return value;
  }

  return null;
}

function safeNextPath(raw: string | null) {
  if (!raw) {
    return null;
  }

  const value = raw.trim();

  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  if (value.includes('\n') || value.includes('\r')) {
    return null;
  }

  if (value.startsWith('/app') || value.startsWith('/invite/') || value.startsWith('/admin')) {
    return value;
  }

  return null;
}
