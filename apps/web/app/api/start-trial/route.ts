import { NextRequest, NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';

const startTrialSchema = z.object({
  full_name: z.string().trim().min(1, 'يرجى إدخال الاسم الكامل.'),
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.'),
  phone: z.string().trim().optional(),
  firm_name: z.string().trim().optional(),
  website: z.string().trim().max(0, 'تم رفض الطلب.'),
});

type MembershipRow = {
  org_id: string;
};

type TrialRow = {
  ends_at: string;
  status: 'active' | 'expired';
};

type OrgRow = {
  id: string;
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = startTrialSchema.safeParse({
    full_name: toText(formData, 'full_name'),
    email: toText(formData, 'email'),
    password: toText(formData, 'password'),
    phone: toText(formData, 'phone'),
    firm_name: toText(formData, 'firm_name'),
    website: toText(formData, 'website'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const fullName = parsed.data.full_name;
  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const phone = emptyToNull(parsed.data.phone);
  const firmName = emptyToNull(parsed.data.firm_name);

  const adminClient = createSupabaseServerClient();
  const authClient = createSupabaseServerAuthClient();

  const { error: leadError } = await adminClient.from('leads').insert({
    full_name: fullName,
    email,
    phone,
    firm_name: firmName,
  });

  if (leadError) {
    return NextResponse.json({ message: 'تعذر حفظ طلب التجربة. حاول مرة أخرى.' }, { status: 500 });
  }

  const signInResult = await authClient.auth.signInWithPassword({ email, password });
  let session = signInResult.data.session;

  if (!session) {
    if (!isInvalidCredentials(signInResult.error?.message)) {
      return NextResponse.json({ message: 'تعذر بدء التجربة. حاول مرة أخرى.' }, { status: 401 });
    }

    const createUserResult = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    });

    if (createUserResult.error) {
      if (isAlreadyRegistered(createUserResult.error.message)) {
        const redirectUrl = new URL('/signin', request.url);
        redirectUrl.searchParams.set('email', email);
        redirectUrl.searchParams.set('reason', 'exists');
        return NextResponse.redirect(redirectUrl, 303);
      }

      return NextResponse.json({ message: 'تعذر إنشاء الحساب. حاول مرة أخرى.' }, { status: 500 });
    }

    const secondSignInResult = await authClient.auth.signInWithPassword({ email, password });
    if (secondSignInResult.error || !secondSignInResult.data.session) {
      return NextResponse.json(
        { message: 'تم إنشاء الحساب لكن تعذر تسجيل الدخول. استخدم صفحة تسجيل الدخول.' },
        { status: 500 },
      );
    }

    session = secondSignInResult.data.session;
  }

  try {
    const userId = session.user.id;
    const { isExpired } = await provisionTrial({
      adminClient,
      userId,
      firmName,
    });

    const destination = isExpired ? '/app/expired' : '/app';
    return buildSessionRedirectResponse(request, destination, session);
  } catch {
    return NextResponse.json({ message: 'تعذر تهيئة التجربة. حاول مرة أخرى.' }, { status: 500 });
  }
}

async function provisionTrial(params: {
  adminClient: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
  firmName: string | null;
}) {
  const { adminClient, userId, firmName } = params;

  const { data: membershipData, error: membershipError } = await adminClient
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  let orgId = (membershipData as MembershipRow | null)?.org_id ?? null;

  if (!orgId) {
    const { data: organizationData, error: organizationError } = await adminClient
      .from('organizations')
      .insert({
        name: firmName ?? 'مكتب جديد',
      })
      .select('id')
      .single();

    if (organizationError) {
      throw organizationError;
    }

    orgId = (organizationData as OrgRow).id;

    const { error: membershipInsertError } = await adminClient.from('memberships').insert({
      org_id: orgId,
      user_id: userId,
      role: 'owner',
    });

    if (membershipInsertError) {
      throw membershipInsertError;
    }
  }

  const { data: trialData, error: trialError } = await adminClient
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (trialError) {
    throw trialError;
  }

  const trial = trialData as TrialRow | null;

  if (!trial) {
    const now = Date.now();
    const { error: trialInsertError } = await adminClient.from('trial_subscriptions').insert({
      org_id: orgId,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });

    if (trialInsertError) {
      throw trialInsertError;
    }

    return {
      orgId,
      isExpired: false,
    };
  }

  const isExpired = trial.status === 'expired' || Date.now() >= new Date(trial.ends_at).getTime();

  return {
    orgId,
    isExpired,
  };
}

function buildSessionRedirectResponse(
  request: NextRequest,
  destination: '/app' | '/app/expired',
  session: Session,
) {
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
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

function toText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isInvalidCredentials(message?: string) {
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes('invalid login credentials');
}

function isAlreadyRegistered(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('already') || normalized.includes('registered');
}
