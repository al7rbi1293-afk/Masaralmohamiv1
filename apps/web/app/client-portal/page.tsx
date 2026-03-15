import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentClientPortalSession } from '@/lib/client-portal/session';

export const metadata: Metadata = {
  title: 'بوابة العميل',
  description: 'لوحة متابعة القضايا والفواتير والمستندات للعميل.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/client-portal',
  },
};

const MATTER_STATUS_LABELS: Record<string, string> = {
  new: 'جديدة',
  in_progress: 'قيد المعالجة',
  on_hold: 'معلّقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوعة',
  partial: 'مدفوعة جزئيًا',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

export default async function ClientPortalHomePage() {
  const session = await getCurrentClientPortalSession();
  if (!session) {
    redirect('/client-portal/signin');
  }

  const db = createSupabaseServerClient();

  const { data: portalUser } = await db
    .from('client_portal_users')
    .select('id, email, status')
    .eq('id', session.portalUserId)
    .eq('org_id', session.orgId)
    .eq('client_id', session.clientId)
    .eq('email', session.email)
    .maybeSingle();

  if (!portalUser || String((portalUser as any).status || '') !== 'active') {
    redirect('/client-portal/signin');
  }

  const [clientRes, mattersRes, invoicesRes, documentsRes] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, phone')
      .eq('id', session.clientId)
      .eq('org_id', session.orgId)
      .maybeSingle(),
    db
      .from('matters')
      .select('id, title, status, updated_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('updated_at', { ascending: false })
      .limit(5),
    db
      .from('invoices')
      .select('id, number, status, total, currency, issued_at, due_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('issued_at', { ascending: false })
      .limit(5),
    db
      .from('documents')
      .select('id, title, created_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const client = clientRes.data as { name?: string; email?: string | null; phone?: string | null } | null;
  if (!client) {
    redirect('/client-portal/signin');
  }

  const matters = (mattersRes.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
  }>;
  const invoices = (invoicesRes.data ?? []) as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string | null;
    issued_at: string | null;
    due_at: string | null;
  }>;
  const documents = (documentsRes.data ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
  }>;

  const openMattersCount = matters.filter((matter) => matter.status !== 'closed' && matter.status !== 'archived').length;
  const unpaidInvoicesCount = invoices.filter((invoice) => invoice.status === 'unpaid' || invoice.status === 'partial').length;

  return (
    <Section className="py-12 sm:py-16">
      <Container className="max-w-5xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مرحبًا {client.name}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                هذه لوحة المتابعة الخاصة بك في بوابة العميل.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                {client.email || session.email}
                {client.phone ? ` · ${client.phone}` : ''}
              </p>
            </div>

            <form action="/api/client-portal/auth/logout" method="post">
              <button type="submit" className={buttonVariants('outline', 'sm')}>
                تسجيل الخروج
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="القضايا المفتوحة" value={openMattersCount} />
            <StatCard label="فواتير غير مكتملة" value={unpaidInvoicesCount} />
            <StatCard label="المستندات الأخيرة" value={documents.length} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-brand-border p-4 dark:border-slate-700">
              <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">آخر القضايا</h2>
              {matters.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">لا توجد قضايا مرتبطة بحسابك حتى الآن.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {matters.map((matter) => (
                    <li key={matter.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{matter.title}</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        الحالة: {MATTER_STATUS_LABELS[matter.status] || matter.status}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        آخر تحديث: {formatDateTime(matter.updated_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-brand-border p-4 dark:border-slate-700">
              <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">آخر الفواتير</h2>
              {invoices.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">لا توجد فواتير ظاهرة لك حاليًا.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {invoices.map((invoice) => (
                    <li key={invoice.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                      <p className="font-medium text-slate-800 dark:text-slate-100">فاتورة #{invoice.number}</p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        الحالة: {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        الإجمالي: {Number(invoice.total || 0).toFixed(2)} {invoice.currency || 'SAR'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        تاريخ الإصدار: {formatDate(invoice.issued_at)}
                        {invoice.due_at ? ` • الاستحقاق: ${formatDate(invoice.due_at)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-navy dark:text-slate-100">{value}</p>
    </div>
  );
}

function formatDate(rawDate: string | null) {
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-SA');
}

function formatDateTime(rawDate: string | null) {
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
