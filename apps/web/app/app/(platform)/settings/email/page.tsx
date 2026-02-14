import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireOwner } from '@/lib/org';
import { isSmtpConfigured } from '@/lib/env';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

type EmailLogRow = {
  id: string;
  to_email: string;
  subject: string;
  template: string;
  status: 'sent' | 'failed';
  created_at: string;
};

const templateLabel: Record<string, string> = {
  doc_share: 'مشاركة مستند',
  invoice: 'فاتورة',
  task_reminder: 'تذكير مهمة',
};

export default async function EmailSettingsPage() {
  let orgId = '';

  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'لا تملك صلاحية الوصول.';
    return (
      <Card className="p-6">
        <EmptyState title="إعدادات البريد" message={message} backHref="/app/settings" backLabel="العودة للإعدادات" />
      </Card>
    );
  }

  const configured = isSmtpConfigured();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('email_logs')
    .select('id, to_email, subject, template, status, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = (data as EmailLogRow[] | null) ?? [];

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">إعدادات البريد</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            إرسال روابط المستندات والفواتير والتذكيرات عبر SMTP مع سجل بسيط.
          </p>
        </div>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-brand-navy dark:text-slate-100">حالة SMTP</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {configured
                ? 'تم رصد متغيرات SMTP في البيئة.'
                : 'لم يتم ضبط متغيرات SMTP بعد. فعّلها في Vercel ثم أعد النشر.'}
            </p>
          </div>
          <Badge variant={configured ? 'success' : 'warning'}>{configured ? 'مفعّل' : 'غير مفعّل'}</Badge>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          المتغيرات المطلوبة: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{' '}
          <code>SMTP_PASS</code>, <code>SMTP_FROM</code>.
        </p>
      </div>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-brand-navy dark:text-slate-100">سجل الإرسال</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">آخر 20 عملية إرسال (للمالك فقط).</p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            تعذر تحميل السجل. {error.message}
          </p>
        ) : rows.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3 text-start font-medium">القالب</th>
                  <th className="px-3 py-3 text-start font-medium">إلى</th>
                  <th className="px-3 py-3 text-start font-medium">الموضوع</th>
                  <th className="px-3 py-3 text-start font-medium">الحالة</th>
                  <th className="px-3 py-3 text-start font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {templateLabel[row.template] ?? row.template}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.to_email}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.subject}</td>
                    <td className="px-3 py-3">
                      <Badge variant={row.status === 'sent' ? 'success' : 'danger'}>
                        {row.status === 'sent' ? 'تم' : 'فشل'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {new Date(row.created_at).toLocaleString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState title="لا يوجد سجل" message="لم يتم إرسال أي رسائل بعد." backHref="/app" backLabel="العودة للوحة التحكم" />
          </div>
        )}
      </section>
    </Card>
  );
}

