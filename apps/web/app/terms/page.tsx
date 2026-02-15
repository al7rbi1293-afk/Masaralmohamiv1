import type { Metadata } from 'next';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'الشروط والأحكام',
  description: 'شروط وأحكام استخدام منصة مسار المحامي، بما يشمل الحسابات، الاستخدام المقبول، والمسؤولية.',
  openGraph: {
    title: 'الشروط والأحكام | مسار المحامي',
    description: 'الشروط القانونية المنظمة لاستخدام منصة مسار المحامي.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <Section title="الشروط والأحكام" subtitle="تاريخ آخر تحديث: 15 فبراير 2025">
      <div className="space-y-6 rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">قبول الشروط</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            باستخدامك منصة مسار المحامي فإنك توافق على هذه الشروط وعلى الالتزام بها.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الحسابات</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            أنت مسؤول عن صحة بيانات الحساب والمحافظة على سرية بيانات الدخول وإدارة صلاحيات المستخدمين في مكتبك.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الاستخدام المقبول</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            يمنع استخدام المنصة لأي غرض غير قانوني أو يضر بالمنصة أو بالمستخدمين الآخرين أو ينتهك الحقوق.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الملكية الفكرية</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            جميع حقوق المنصة ومكوناتها محفوظة. تبقى بيانات المكتب ملكًا للمكتب نفسه.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">التوفر والاستمرارية</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            نسعى لتقديم خدمة مستقرة، مع إمكانية وجود توقفات مجدولة للصيانة أو توقفات طارئة خارج السيطرة.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الخطط والمدفوعات</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            تفاصيل الأسعار والاشتراكات تُحدد ضمن خطة الاستخدام المختارة، وقد تخضع للتحديث مع إشعار مناسب.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">الإيقاف أو الإنهاء</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            يمكن إيقاف أو إنهاء الحساب في حال مخالفة الشروط أو بطلب من العميل وفق إجراءات الإلغاء المعتمدة.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">حدود المسؤولية</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            تُقدَّم الخدمة كما هي، وتقتصر المسؤولية على الحدود المسموح بها نظامًا في المملكة العربية السعودية.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">القانون الحاكم</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتكون الجهات القضائية المختصة داخل المملكة صاحبة الاختصاص.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">التواصل</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            للاستفسارات القانونية أو التعاقدية:
            <a href="mailto:masar.almohami@outlook.sa" className="font-medium text-brand-emerald">
              {' '}masar.almohami@outlook.sa
            </a>
          </p>
        </article>
      </div>
    </Section>
  );
}
