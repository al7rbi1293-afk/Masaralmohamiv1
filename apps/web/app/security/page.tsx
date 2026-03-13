import type { Metadata } from 'next';
import { Section } from '@/components/ui/section';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { CUSTOMER_SERVICE_WHATSAPP_LINK, CUSTOMER_SERVICE_WHATSAPP_NUMBER, SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = {
  title: 'الأمان والخصوصية',
  description:
    'تعرف على ممارسات الأمان في مسار المحامي: عزل البيانات، الصلاحيات، حماية الملفات، وسجل التدقيق.',
  alternates: {
    canonical: '/security',
  },
  openGraph: {
    title: 'الأمان والخصوصية في مسار المحامي',
    description: 'تفاصيل الأمان والخصوصية لعملاء مسار المحامي.',
    url: '/security',
  },
};

const sections = [
  {
    title: 'عزل بيانات كل مكتب',
    body: 'كل مكتب يعمل في بيئة بيانات مستقلة بالكامل مع عزل منطقي صارم بين المستأجرين.',
  },
  {
    title: 'RBAC وصلاحيات الوصول',
    body: 'التحكم بالصلاحيات قائم على الأدوار (Partner / Lawyer / Assistant) مع تطبيق السياسات على مستوى الخادم.',
  },
  {
    title: 'حماية الملفات بروابط موقعة',
    body: 'تنزيل الملفات يتم عبر Signed URLs قصيرة العمر، بدون روابط عامة دائمة.',
  },
  {
    title: 'روابط مشاركة مؤقتة',
    body: 'روابط مشاركة المستندات تنتهي تلقائيًا وفق مدة محددة ويمكن إلغاؤها في أي وقت.',
  },
  {
    title: 'سجل تدقيق شامل',
    body: 'يتم تسجيل العمليات الحساسة مثل تسجيل الدخول، المشاركة، التعديل، الحذف، والتنزيل لشفافية أعلى.',
  },
  {
    title: 'نسخ احتياطية واستمرارية',
    body: 'تُطبق خطط نسخ احتياطي دورية مع إجراءات استعادة تساعد على الحفاظ على استمرارية العمل.',
  },
];

export default function SecurityPage() {
  return (
    <Section
      titleAs="h1"
      title="الأمان والخصوصية في مسار المحامي"
      subtitle="نحن نبني المنصة بمنهجية حماية افتراضية لكل طبقة من طبقات النظام."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((item) => (
          <article
            key={item.title}
            className="rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-xl2 border border-brand-border bg-brand-background p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">التواصل الأمني</h2>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          لأي بلاغ أمني أو استفسار متعلق بحماية البيانات: 
          <a className="font-medium text-brand-emerald" href={`mailto:${SUPPORT_EMAIL}`}>
            {' '}{SUPPORT_EMAIL}
          </a>
        </p>
        <a
          href={CUSTOMER_SERVICE_WHATSAPP_LINK}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-emerald hover:opacity-90"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]">
            <WhatsAppIcon className="h-4 w-4" />
          </span>
          <span>واتساب خدمة العملاء</span>
          <span dir="ltr">{CUSTOMER_SERVICE_WHATSAPP_NUMBER}</span>
        </a>
      </div>
    </Section>
  );
}
