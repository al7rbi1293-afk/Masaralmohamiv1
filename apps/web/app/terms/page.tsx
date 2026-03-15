import type { Metadata } from 'next';
import { Section } from '@/components/ui/section';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { CUSTOMER_SERVICE_WHATSAPP_LINK, CUSTOMER_SERVICE_WHATSAPP_NUMBER, SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = {
  title: 'الشروط والأحكام',
  description: 'شروط وأحكام استخدام منصة مسار المحامي، بما يشمل الحسابات، الاستخدام المقبول، والمسؤولية.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'الشروط والأحكام | مسار المحامي',
    description: 'الشروط القانونية المنظمة لاستخدام منصة مسار المحامي.',
    url: '/terms',
    images: ['/masar-logo.png'],
  },
};

export default function TermsPage() {
  return (
    <Section titleAs="h1" title="الشروط والأحكام" subtitle="تاريخ آخر تحديث: 15 فبراير 2025">
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

        <article dir="rtl">
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">سياسة الاسترجاع والاسترداد</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            تلتزم منصة مسار المحامي بالوضوح والشفافية في تنظيم آلية الاسترجاع والاسترداد للاشتراكات والخدمات الإلكترونية
            المقدمة عبر المنصة.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            يحق للمستخدم طلب استرداد رسوم الاشتراك خلال 7 أيام من تاريخ الشراء، بشرط عدم تفعيل الحساب المدفوع أو عدم
            استخدام المنصة أو الانتفاع بأي من خدماتها أو مزاياها المدفوعة.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            وبمجرد تفعيل الاشتراك أو بدء استخدام المنصة أو الاستفادة من أي خدمة رقمية مقدمة عبرها، فإن رسوم الاشتراك عن
            الفترة الحالية تعد غير مستردة.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            ويجوز للمستخدم إلغاء التجديد التلقائي قبل موعد التجديد القادم، على أن يستمر الاشتراك حتى نهاية المدة المدفوعة،
            دون استرداد عن الفترة الجارية بعد بدئها.
          </p>

          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">ويحق للمستخدم طلب الاسترداد في الحالات التالية:</p>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
            <li>إذا تم دفع الرسوم ولم يتم تفعيل الاشتراك.</li>
            <li>إذا تم خصم المبلغ أكثر من مرة أو وقع خطأ في عملية السداد.</li>
            <li>إذا وجد خلل تقني جوهري من طرف المنصة حال دون الانتفاع بالخدمة ولم تتم معالجته خلال مدة معقولة.</li>
            <li>إذا تم إلغاء الطلب قبل الانتفاع بالخدمة وضمن المدة النظامية.</li>
          </ul>

          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">ولا يحق طلب الاسترداد في الحالات التالية:</p>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
            <li>بعد تفعيل الاشتراك أو بدء استخدام المنصة.</li>
            <li>إذا كان سبب الطلب مجرد العدول عن الاشتراك بعد الانتفاع بالخدمة.</li>
            <li>إذا كانت الخدمة قد نُفذت أو بدأ استخدامها فعليًا.</li>
            <li>إذا كانت الخدمة مخصصة أو معدّة خصيصًا بناءً على طلب المستخدم.</li>
          </ul>

          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            تتم مراجعة طلبات الاسترداد خلال مدة تقديرية من 5 إلى 10 أيام عمل من تاريخ استلام الطلب مكتملًا، وفي حال
            الموافقة يتم رد المبلغ عبر وسيلة الدفع الأصلية متى أمكن ذلك.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            ولتقديم طلب الاسترداد، يجب التواصل عبر القنوات الرسمية المعتمدة لدى المنصة مع تزويدنا ببيانات الحساب ورقم
            الطلب أو مرجع عملية الدفع وسبب الطلب.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            وتخضع هذه السياسة للأنظمة واللوائح المعمول بها في المملكة العربية السعودية، وفي حال وجود أي تعارض، يُعمل
            بالنص النظامي الواجب التطبيق.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">التواصل</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
            للاستفسارات القانونية أو التعاقدية:
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-emerald">
              {' '}{SUPPORT_EMAIL}
            </a>
          </p>
          <a
            href={CUSTOMER_SERVICE_WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-emerald hover:opacity-90"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]">
              <WhatsAppIcon className="h-4 w-4" />
            </span>
            <span>واتساب خدمة العملاء</span>
            <span dir="ltr">{CUSTOMER_SERVICE_WHATSAPP_NUMBER}</span>
          </a>
        </article>
      </div>
    </Section>
  );
}
