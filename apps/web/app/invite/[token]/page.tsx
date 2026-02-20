import type { Metadata } from 'next';
import Link from 'next/link';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { checkRateLimit, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOutAction } from '@/app/app/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORT_EMAIL = 'masar.almohami@outlook.sa';

export const metadata: Metadata = {
  title: 'قبول الدعوة',
  description: 'قبول دعوة الانضمام إلى فريق مسار المحامي.',
  openGraph: {
    title: 'قبول الدعوة | مسار المحامي',
    description: 'قبول دعوة الانضمام إلى فريق مسار المحامي.',
    url: '/invite',
  },
};

type InvitePageProps = {
  params: {
    token: string;
  };
};

type InvitationRow = {
  id: string;
  org_id: string;
  email: string;
  role: 'owner' | 'lawyer' | 'assistant';
  expires_at: string;
  accepted_at: string | null;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const token = String(params.token ?? '').trim();
  if (!isSafeToken(token)) {
    return renderMessage({
      title: 'الرابط غير صالح.',
      body: 'تحقق من الرابط أو اطلب رابطًا جديدًا من مالك المكتب.',
      primary: { href: '/', label: 'العودة للموقع' },
    });
  }

  const service = createSupabaseServerClient();
  const { data: invitation, error: invitationError } = await service
    .from('org_invitations')
    .select('id, org_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (invitationError || !invitation) {
    return renderMessage({
      title: 'الرابط غير صالح.',
      body: 'تحقق من الرابط أو اطلب رابطًا جديدًا من مالك المكتب.',
      primary: { href: '/', label: 'العودة للموقع' },
    });
  }

  const row = invitation as InvitationRow;
  const invitedEmail = String(row.email ?? '').trim().toLowerCase();
  const nowMs = Date.now();
  const expiresAtMs = new Date(row.expires_at).getTime();
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;

  if (isExpired) {
    return renderMessage({
      title: 'انتهت صلاحية رابط الدعوة.',
      body: 'اطلب من مالك المكتب إنشاء رابط دعوة جديد. إذا احتجت مساعدة: تواصل معنا.',
      primary: { href: `mailto:${SUPPORT_EMAIL}`, label: 'تواصل معنا' },
      secondary: { href: '/', label: 'العودة للموقع' },
    });
  }

  const currentUser = await getCurrentAuthUser();

  if (row.accepted_at) {
    return renderMessage({
      title: 'تم استخدام رابط الدعوة مسبقًا.',
      body: currentUser
        ? 'يمكنك الانتقال إلى لوحة التحكم.'
        : 'إذا كنت عضوًا بالفعل، سجل الدخول للوصول إلى المنصة.',
      primary: currentUser ? { href: '/app', label: 'الانتقال إلى لوحة التحكم' } : { href: '/signin', label: 'تسجيل الدخول' },
      secondary: { href: '/', label: 'العودة للموقع' },
    });
  }

  if (!currentUser) {
    const signInUrl = `/signin?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitedEmail)}`;
    const signUpUrl = `/signup?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitedEmail)}`;

    return (
      <Section className="py-16 sm:py-20">
        <Container className="max-w-xl">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
              انضم إلى فريق مسار المحامي
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              أكمل تسجيل الدخول أو أنشئ حسابًا لقبول الدعوة.
            </p>

            <p className="mt-4 rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              يجب استخدام البريد المدعو: <span className="font-medium">{invitedEmail}</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={signInUrl} className={buttonVariants('primary', 'md')}>
                تسجيل الدخول
              </Link>
              <Link href={signUpUrl} className={buttonVariants('outline', 'md')}>
                إنشاء حساب
              </Link>
            </div>

            <div className="mt-4">
              <Link href="/" className="text-sm text-brand-emerald hover:underline">
                العودة للموقع
              </Link>
            </div>
          </Card>
        </Container>
      </Section>
    );
  }

  const currentEmail = currentUser.email.trim().toLowerCase();
  if (currentEmail !== invitedEmail) {
    const signInUrl = `/signin?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitedEmail)}`;
    return (
      <Section className="py-16 sm:py-20">
        <Container className="max-w-xl">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">تعذر قبول الدعوة</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              هذا الرابط مخصص للبريد: <span className="font-medium">{invitedEmail}</span>. أنت مسجل دخول ببريد مختلف.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <form action={signOutAction}>
                <button type="submit" className={buttonVariants('outline', 'md')}>
                  تسجيل الخروج
                </button>
              </form>
              <Link href={signInUrl} className={buttonVariants('primary', 'md')}>
                الانتقال لتسجيل الدخول
              </Link>
            </div>

            <div className="mt-4">
              <Link href="/" className="text-sm text-brand-emerald hover:underline">
                العودة للموقع
              </Link>
            </div>
          </Card>
        </Container>
      </Section>
    );
  }

  const ip = getRequestIpFromHeaders();
  const limit = checkRateLimit({
    key: `invite_accept:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return renderMessage({
      title: RATE_LIMIT_MESSAGE_AR,
      body: 'إذا استمرت المشكلة، تواصل معنا.',
      primary: { href: `mailto:${SUPPORT_EMAIL}`, label: 'تواصل معنا' },
      secondary: { href: '/', label: 'العودة للموقع' },
    });
  }

  const acceptedAt = new Date().toISOString();

  const { error: membershipError } = await service
    .from('memberships')
    .upsert(
      {
        org_id: row.org_id,
        user_id: currentUser.id,
        role: row.role,
      },
      { onConflict: 'org_id,user_id' },
    );

  if (membershipError) {
    return renderMessage({
      title: 'تعذر قبول الدعوة.',
      body: 'حاول مرة أخرى أو اطلب من مالك المكتب إرسال رابط جديد.',
      primary: { href: `mailto:${SUPPORT_EMAIL}`, label: 'تواصل معنا' },
      secondary: { href: '/', label: 'العودة للموقع' },
    });
  }

  await service
    .from('org_invitations')
    .update({ accepted_at: acceptedAt })
    .eq('id', row.id)
    .is('accepted_at', null);

  const h = headers();
  const userAgent = h.get('user-agent') || null;

  await service.from('audit_logs').insert({
    org_id: row.org_id,
    user_id: currentUser.id,
    action: 'team.invite_accepted',
    entity_type: 'org_invitation',
    entity_id: row.id,
    meta: { role: row.role },
    ip: ip === 'unknown' ? null : ip,
    user_agent: userAgent,
  });

  cookies().set('active_org_id', row.org_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  redirect('/app');
}

function isSafeToken(value: string) {
  return /^[A-Za-z0-9_-]{20,200}$/.test(value);
}

function getRequestIpFromHeaders() {
  const h = headers();
  const forwardedFor = h.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first) {
      return first.trim();
    }
  }

  const realIp = h.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

function renderMessage({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">{title}</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{body}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={primary.href} className={buttonVariants('primary', 'md')}>
              {primary.label}
            </Link>
            {secondary ? (
              <Link href={secondary.href} className={buttonVariants('outline', 'md')}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
