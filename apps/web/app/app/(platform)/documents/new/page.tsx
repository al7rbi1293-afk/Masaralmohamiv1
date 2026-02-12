import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { DocumentUploader } from '@/components/app/document-uploader';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';

type NewDocumentPageProps = {
  searchParams?: {
    matter?: string;
  };
};

type MatterOption = { id: string; title: string };

export default async function NewDocumentPage({ searchParams }: NewDocumentPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  const initialMatterId = (searchParams?.matter ?? '').trim();

  const supabase = createSupabaseServerRlsClient();
  const { data: mattersData } = orgId
    ? await supabase
        .from('matters')
        .select('id, title')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] as any };

  const matters = (mattersData as MatterOption[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">رفع مستند</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ مستندًا وارفع أول نسخة باستخدام رابط رفع مؤقت.
          </p>
        </div>
        <Link href="/app/documents" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <div className="mt-6">
        <DocumentUploader matters={matters} initialMatterId={initialMatterId} />
      </div>
    </section>
  );
}

