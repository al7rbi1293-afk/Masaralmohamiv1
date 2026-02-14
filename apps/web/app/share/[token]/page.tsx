import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

type SharePageProps = {
  params: { token: string };
};

export default async function SharePage({ params }: SharePageProps) {
  const token = params.token.trim();

  if (!token) {
    return <ShareMessage title="مشاركة مستند" message="الرابط غير صالح" />;
  }

  const service = createSupabaseServerClient();

  try {
    const { data: share, error: shareError } = await withTimeout(
      service
        .from('document_shares')
        .select('document_id, expires_at')
        .eq('token', token)
        .maybeSingle(),
      5_000,
      'تعذر التحقق من الرابط.',
    );

    if (shareError || !share) {
      return <ShareMessage title="مشاركة مستند" message="الرابط غير صالح" />;
    }

    const expiresAt = new Date(share.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return <ShareMessage title="مشاركة مستند" message="الرابط منتهي" />;
    }

    const { data: latestVersion, error: versionError } = await withTimeout(
      service
        .from('document_versions')
        .select('storage_path, file_name')
        .eq('document_id', share.document_id)
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      5_000,
      'تعذر العثور على المستند.',
    );

    if (versionError || !latestVersion) {
      return <ShareMessage title="مشاركة مستند" message="تعذر العثور على المستند." />;
    }

    const signedResult = (await withCircuitBreaker(
      'storage.signed_share_download',
      { failureThreshold: 3, cooldownMs: 30_000 },
      () =>
        withTimeout(
          service.storage.from('documents').createSignedUrl(latestVersion.storage_path, 300),
          6_000,
          'تعذر تجهيز رابط التنزيل.',
        ),
    )) as { data: { signedUrl: string } | null; error: { message?: string } | null };

    const signedUrl = signedResult.data?.signedUrl ?? null;
    if (signedResult.error || !signedUrl) {
      return <ShareMessage title="مشاركة مستند" message="تعذر تجهيز رابط التنزيل." />;
    }

    return (
      <Container className="py-12">
        <Card className="mx-auto max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مشاركة مستند</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            يمكنك تنزيل المستند عبر الرابط المؤقت أدناه.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href={signedUrl}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-emerald px-5 text-sm font-medium text-white hover:bg-green-600"
            >
              تنزيل المستند
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              الرابط مؤقت وسيتم إيقافه تلقائيًا.
            </p>
          </div>
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
      return <ShareMessage title="مشاركة مستند" message="الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل." />;
    }

    return <ShareMessage title="مشاركة مستند" message="تعذر تجهيز رابط التنزيل." />;
  }
}

function ShareMessage({ title, message }: { title: string; message: string }) {
  return (
    <Container className="py-12">
      <Card className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">{title}</h1>
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{message}</p>
      </Card>
    </Container>
  );
}
