import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { DocumentDetailClient } from '@/components/app/document-detail-client';

type DocumentDetailsPageProps = {
  params: { id: string };
  searchParams?: { uploaded?: string };
};

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  folder: string;
  tags: string[];
  created_at: string;
  matter_id: string | null;
};

type VersionRow = {
  id: string;
  version_no: number;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
};

type MatterRow = { id: string; title: string };

export default async function DocumentDetailsPage({ params, searchParams }: DocumentDetailsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    notFound();
  }

  const supabase = createSupabaseServerRlsClient();
  const { data: documentData, error: documentError } = await supabase
    .from('documents')
    .select('id, title, description, folder, tags, created_at, matter_id')
    .eq('org_id', orgId)
    .eq('id', params.id)
    .maybeSingle();

  if (documentError || !documentData) {
    notFound();
  }

  const document = documentData as DocumentRow;

  const { data: versionsData } = await supabase
    .from('document_versions')
    .select('id, version_no, file_name, file_size, mime_type, storage_path, created_at')
    .eq('org_id', orgId)
    .eq('document_id', document.id)
    .order('version_no', { ascending: false })
    .limit(50);

  const versions = (versionsData as VersionRow[] | null) ?? [];

  const { data: matterData } = document.matter_id
    ? await supabase
        .from('matters')
        .select('id, title')
        .eq('org_id', orgId)
        .eq('id', document.matter_id)
        .maybeSingle()
    : { data: null as any };

  const matter = (matterData as MatterRow | null) ?? null;
  const uploaded = searchParams?.uploaded ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{document.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {document.folder} {matter ? `• ${matter.title}` : ''}
          </p>
          {document.tags?.length ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
              {document.tags.slice(0, 12).map((tag) => (
                <span key={tag} className="rounded-full border border-brand-border bg-brand-background px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link href="/app/documents" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {uploaded ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          تم رفع الملف بنجاح.
        </p>
      ) : null}

      {document.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{document.description}</p>
      ) : null}

      <div className="mt-6">
        <DocumentDetailClient documentId={document.id} versions={versions} />
      </div>
    </section>
  );
}

