import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { getPublicSiteUrl } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

export const metadata: Metadata = {
  title: 'دعوة للانضمام',
  description: 'قبول دعوة الانضمام إلى مكتب في مسار المحامي.',
  openGraph: {
    title: 'دعوة | مسار المحامي',
    description: 'قبول دعوة الانضمام إلى مكتب في مسار المحامي.',
    url: '/invite',
  },
};

type InvitePageProps = {
  params: { token: string };
};

export default async function InvitePage({ params }: InvitePageProps) {
  const token = String(params.token || '').trim();
  if (!token) {
    return renderInvalid();
  }

  const service = createSupabaseServerClient();
  const { data: invite, error } = await service
    .from('org_invitations')
    .select('id, org_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    return renderInvalid();
  }

  const expiresAt = new Date(invite.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return (
      <Card className="mx-auto mt-16 max-w-xl p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الدعوة منتهية</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          هذا الرابط انتهى. اطلب من مالك المكتب إرسال دعوة جديدة أو تواصل معنا.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/contact" className={buttonVariants('primary', 'sm')}>
            تواصل معنا
          </Link>
          <Link href="/" className={buttonVariants('outline', 'sm')}>
            العودة للموقع
          </Link>
        </div>
      </Card>
    );
  }

  if (invite.accepted_at) {
    return (
      <Card className="mx-auto mt-16 max-w-xl p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تم قبول الدعوة</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          هذه الدعوة تم استخدامها مسبقًا. يمكنك الدخول إلى المنصة.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/app" className={buttonVariants('primary', 'sm')}>
            الدخول للمنصة
          </Link>
          <Link href="/" className={buttonVariants('outline', 'sm')}>
            العودة للموقع
          </Link>
        </div>
      </Card>
    );
  }

  const user = await getCurrentAuthUser();
  const nextPath = `/invite/${encodeURIComponent(token)}`;

  if (!user) {
    const signInUrl = new URL('/signin', getPublicSiteUrl());
    signInUrl.searchParams.set('next', nextPath);
    signInUrl.searchParams.set('email', invite.email);

    const signUpUrl = new URL('/signup', getPublicSiteUrl());
    signUpUrl.searchParams.set('next', nextPath);
    signUpUrl.searchParams.set('email', invite.email);

    return (
      <Card className="mx-auto mt-16 max-w-xl p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">دعوة للانضمام</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          لإكمال الانضمام، سجّل الدخول أو أنشئ حسابًا بالبريد: <span className="font-medium">{invite.email}</span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={signInUrl.pathname + signInUrl.search} className={buttonVariants('primary', 'sm')}>
            تسجيل الدخول
          </Link>
          <Link href={signUpUrl.pathname + signUpUrl.search} className={buttonVariants('outline', 'sm')}>
            إنشاء حساب
          </Link>
        </div>
      </Card>
    );
  }

  if (user.email.toLowerCase() !== String(invite.email).toLowerCase()) {
    return (
      <Card className="mx-auto mt-16 max-w-xl p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تعذر قبول الدعوة</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          هذه الدعوة موجهة للبريد: <span className="font-medium">{invite.email}</span>. أنت مسجل الدخول ببريد مختلف.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/app" className={buttonVariants('primary', 'sm')}>
            الانتقال للمنصة
          </Link>
          <Link href="/contact" className={buttonVariants('outline', 'sm')}>
            تواصل معنا
          </Link>
        </div>
      </Card>
    );
  }

  try {
    const { error: membershipError } = await service.from('memberships').upsert(
      {
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: 'org_id,user_id' },
    );

    if (membershipError) {
      throw membershipError;
    }

    const { error: acceptedError } = await service
      .from('org_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    if (acceptedError) {
      throw acceptedError;
    }

    await logAudit({
      action: 'team.invite_accepted',
      entityType: 'org_invitation',
      entityId: invite.id,
      meta: { email: invite.email, role: invite.role },
      orgId: invite.org_id,
    });

    logInfo('team_invite_accepted', { orgId: invite.org_id, email: invite.email, role: invite.role });
  } catch (acceptError) {
    const message = acceptError instanceof Error ? acceptError.message : 'unknown';
    logError('team_invite_accept_failed', { message });
    return (
      <Card className="mx-auto mt-16 max-w-xl p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تعذر قبول الدعوة</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          تعذر إكمال الانضمام. حاول مرة أخرى أو تواصل معنا.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/contact" className={buttonVariants('primary', 'sm')}>
            تواصل معنا
          </Link>
          <Link href="/" className={buttonVariants('outline', 'sm')}>
            العودة للموقع
          </Link>
        </div>
      </Card>
    );
  }

  redirect('/app');
}

function renderInvalid() {
  return (
    <Card className="mx-auto mt-16 max-w-xl p-6">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">دعوة غير صالحة</h1>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
        الرابط غير صحيح أو تم إلغاؤه.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/" className={buttonVariants('primary', 'sm')}>
          العودة للموقع
        </Link>
        <Link href="/contact" className={buttonVariants('outline', 'sm')}>
          تواصل معنا
        </Link>
      </div>
    </Card>
  );
}

