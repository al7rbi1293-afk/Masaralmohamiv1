import type { Metadata } from 'next';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description: 'سياسة الخصوصية في مسار المحامي: البيانات التي نجمعها، أغراض المعالجة، والحقوق المتاحة لك.',
  openGraph: {
    title: 'سياسة الخصوصية | مسار المحامي',
    description: 'تفاصيل سياسة الخصوصية لمستخدمي مسار المحامي.',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <Section
      title="سياسة الخصوصية"
      subtitle="تاريخ آخر تحديث: 15 فبراير 2025"
    >
      <div className="space-y-6 rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">من نحن</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            مسار المحامي منصة سحابية لإدارة مكتب المحاماة. نلتزم بحماية بيانات عملائنا والتعامل معها وفق أفضل الممارسات المهنية.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">البيانات التي نجمعها</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            نجمع بيانات الحساب الأساسية، بيانات الاستخدام الفنية،لأغراض الصيانة و التحسينات.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">أغراض المعالجة</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            نستخدم البيانات لتشغيل الخدمة، تحسين الأداء، تعزيز الأمان، وتقديم الدعم الفني للمستخدمين.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">المشاركة مع أطراف ثالثة</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            لا نبيع البيانات. قد تتم المشاركة فقط مع مزودي خدمة موثوقين لتشغيل المنصة وفق اتفاقيات حماية مناسبة.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الاحتفاظ بالبيانات</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            نحتفظ بالبيانات حسب مدة الاشتراك وسياسات الاحتفاظ المتفق عليها، ثم تُحذف أو تُجهّل وفق المعايير المعتمدة.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الأمان</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            نطبق ضوابط وصول، عزل بيانات، سجلات تدقيق، وروابط ملفات موقعة للحد من مخاطر الوصول غير المصرح.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">حقوقك</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها بما يتوافق مع الأنظمة والالتزامات التعاقدية.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">ملفات تعريف الارتباط (Cookies)</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            قد نستخدم ملفات تعريف ارتباط أساسية لتحسين تجربة الاستخدام وحفظ الإعدادات.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">التواصل</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            للاستفسارات المتعلقة بالخصوصية:
            <a href="mailto:masar.almohami@outlook.sa" className="font-medium text-brand-emerald">
              {' '}masar.almohami@outlook.sa
            </a>
          </p>
        </article>
      </div>
    </Section>
  );
}
