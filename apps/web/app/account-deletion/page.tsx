import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Section } from '@/components/ui/section';
import { CUSTOMER_SERVICE_WHATSAPP_LINK, CUSTOMER_SERVICE_WHATSAPP_NUMBER, SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = {
  title: 'حذف الحساب والبيانات',
  description: 'طريقة طلب حذف الحساب والبيانات في مسار المحامي لمستخدمي التطبيق والموقع.',
  alternates: {
    canonical: '/account-deletion',
  },
  openGraph: {
    title: 'حذف الحساب والبيانات | مسار المحامي',
    description: 'إرشادات طلب حذف الحساب والبيانات لمستخدمي مسار المحامي.',
    url: '/account-deletion',
    images: ['/masar-logo.png'],
  },
};

const requestPaths = [
  'من داخل تطبيق iPhone أو Android بعد تسجيل الدخول عبر خيار "طلب حذف الحساب".',
  'من داخل لوحة الويب في إعدادات الخصوصية عندما تكون الحسابات المصرح لها قادرة على الوصول.',
  'عبر فريق الدعم إذا تعذر الدخول إلى الحساب، مع التحقق من الهوية قبل التنفيذ.',
];

const processSteps = [
  'نستقبل الطلب ونربطه بالحساب أو المكتب المعني.',
  'نؤكد الهوية لحماية القضايا والمستندات والبيانات القانونية الحساسة.',
  'ننفذ الحذف أو التقييد المطلوب وفق الالتزامات النظامية والتعاقدية المعمول بها.',
  'نرسل تأكيدًا بعد معالجة الطلب أو نطلب معلومات إضافية عند الحاجة.',
];

export default function AccountDeletionPage() {
  return (
    <Section
      titleAs="h1"
      title="حذف الحساب والبيانات"
      subtitle="مرجع واضح لمستخدمي تطبيق مسار المحامي ولمراجعة متاجر التطبيقات."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-background text-brand-emerald dark:bg-slate-800">
              <Trash2 size={18} />
            </div>
            <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">كيف أطلب حذف الحساب؟</h2>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {requestPaths.map((item) => (
                <li key={item} className="rounded-lg bg-brand-background/60 px-4 py-3 dark:bg-slate-800/70">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-background text-brand-emerald dark:bg-slate-800">
              <ShieldCheck size={18} />
            </div>
            <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">ماذا يحدث بعد الطلب؟</h2>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {processSteps.map((item) => (
                <li key={item} className="rounded-lg bg-brand-background/60 px-4 py-3 dark:bg-slate-800/70">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className="rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">إذا تعذر الدخول إلى الحساب</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
            يمكنك التواصل مباشرة مع فريق مسار المحامي لبدء طلب الحذف أو الاستفسار عن البيانات المشمولة في الطلب.
          </p>

          <div className="mt-5 flex flex-col gap-3 text-sm text-slate-700 dark:text-slate-300">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-emerald hover:opacity-90">
              {SUPPORT_EMAIL}
            </a>
            <a
              href={CUSTOMER_SERVICE_WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-emerald hover:opacity-90"
              dir="ltr"
            >
              واتساب خدمة العملاء: {CUSTOMER_SERVICE_WHATSAPP_NUMBER}
            </a>
            <Link href="/contact" className="font-medium text-brand-emerald hover:opacity-90">
              أو استخدم صفحة التواصل المباشر
            </Link>
          </div>
        </article>
      </div>
    </Section>
  );
}
