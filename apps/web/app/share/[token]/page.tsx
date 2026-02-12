import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type SharePageProps = {
  params: { token: string };
};

type ShareRow = {
  org_id: string;
  document_id: string;
  expires_at: string;
};

type VersionRow = {
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
};

export default async function SharePage({ params }: SharePageProps) {
  const token = params.token;
  if (!token || token.length < 10) {
    notFound();
  }

  const admin = createSupabaseServerClient();
  const { data: shareData } = await admin
    .from('document_shares')
    .select('org_id, document_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!shareData) {
    notFound();
  }

  const share = shareData as ShareRow;
  const expiresAt = new Date(share.expires_at).getTime();
  const isExpired = Date.now() >= expiresAt;

  if (isExpired) {
    return (
      <Section className="py-16 sm:py-20">
        <Container className="max-w-xl">
          <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">الرابط منتهي</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              انتهت صلاحية رابط المشاركة. اطلب رابطًا جديدًا من المكتب.
            </p>
            <Link href="/" className={`mt-6 inline-flex ${buttonVariants('outline', 'md')}`}>
              العودة للموقع
            </Link>
          </div>
        </Container>
      </Section>
    );
  }

  const { data: versionData } = await admin
    .from('document_versions')
    .select('storage_path, file_name, mime_type, file_size')
    .eq('org_id', share.org_id)
    .eq('document_id', share.document_id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!versionData) {
    return (
      <Section className="py-16 sm:py-20">
        <Container className="max-w-xl">
          <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">لا يوجد ملف</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              لا توجد نسخة متاحة لهذا المستند.
            </p>
            <Link href="/" className={`mt-6 inline-flex ${buttonVariants('outline', 'md')}`}>
              العودة للموقع
            </Link>
          </div>
        </Container>
      </Section>
    );
  }

  const version = versionData as VersionRow;

  const { data: signed } = await admin.storage.from('documents').createSignedUrl(version.storage_path, 60 * 10);
  const signedUrl = signed?.signedUrl ?? null;

  await admin.from('audit_logs').insert({
    org_id: share.org_id,
    user_id: null,
    action: 'document_share_viewed',
    entity_type: 'document',
    entity_id: share.document_id,
    meta: { token },
    ip: null,
    user_agent: null,
  });

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">تحميل المستند</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            هذا الرابط مؤقت وينتهي تلقائيًا.
          </p>

          <div className="mt-5 rounded-lg border border-brand-border bg-brand-background p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <p className="font-medium">{version.file_name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {(version.file_size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          {signedUrl ? (
            <a href={signedUrl} className={`mt-6 inline-flex ${buttonVariants('primary', 'md')}`}>
              تنزيل الملف
            </a>
          ) : (
            <p className="mt-6 text-sm text-red-700">تعذر إنشاء رابط التحميل. حاول مرة أخرى.</p>
          )}

          <Link href="/" className={`mt-3 inline-flex ${buttonVariants('outline', 'md')}`}>
            العودة للموقع
          </Link>
        </div>
      </Container>
    </Section>
  );
}

