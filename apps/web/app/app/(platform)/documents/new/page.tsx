import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { DocumentCreateForm } from '@/components/documents/document-create-form';
import { listClients } from '@/lib/clients';
import { listMatters } from '@/lib/matters';

type DocumentNewPageProps = {
  searchParams?: {
    matterId?: string;
    clientId?: string;
  };
};

export default async function DocumentNewPage({ searchParams }: DocumentNewPageProps) {
  const [matters, clients] = await Promise.all([
    listMatters({ status: 'all', page: 1, limit: 50 }),
    listClients({ status: 'active', page: 1, limit: 50 }),
  ]);

  const initialMatterId = (searchParams?.matterId ?? '').trim();
  const initialClientId = (searchParams?.clientId ?? '').trim();

  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'المستندات', href: '/app/documents' },
          { label: 'مستند جديد' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">مستند جديد</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ المستند وارفع النسخة الأولى عبر رابط رفع مؤقت.
          </p>
        </div>
        <Link href="/app/documents" className={buttonVariants('outline', 'sm')}>
          إلغاء
        </Link>
      </div>

      <DocumentCreateForm
        matters={matters.data.map((matter) => ({ id: matter.id, label: matter.title }))}
        clients={clients.data.map((client) => ({ id: client.id, label: client.name }))}
        initialMatterId={initialMatterId}
        initialClientId={initialClientId}
      />
    </Card>
  );
}
