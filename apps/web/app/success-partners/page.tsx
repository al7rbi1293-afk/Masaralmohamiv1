import type { Metadata } from 'next';
import { SuccessPartnersForm } from '@/components/partners/success-partners-form';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'شركاء النجاح',
  description:
    'انضم إلى برنامج شركاء النجاح في مسار المحامي واحصل على عمولات احترافية عند تحويل عملاء مدفوعين.',
  alternates: {
    canonical: '/success-partners',
  },
  openGraph: {
    title: 'شركاء النجاح | مسار المحامي',
    description:
      'برنامج شركاء النجاح: تسويق بالعمولة بنسبة واضحة مع لوحة متابعة إدارية وتتبّع احترافي للإحالات.',
    url: '/success-partners',
    images: ['/masar-logo.png'],
  },
};

const steps = [
  'قدّم طلب الانضمام عبر النموذج أدناه.',
  'تتم مراجعة الطلب من فريق الإدارة والتسويق.',
  'عند الموافقة تحصل على كود إحالة ورابط خاص بك.',
  'يتم احتساب العمولة فقط بعد الدفع الناجح للاشتراك.',
];

const faqs = [
  {
    q: 'متى تُحتسب العمولة؟',
    a: 'تُحتسب العمولة فقط عند الدفع الناجح لاشتراك مدفوع، ولا تُحتسب على التسجيل أو التجربة المجانية فقط.',
  },
  {
    q: 'كم نسبة العمولة؟',
    a: '5% للشريك من قيمة الاشتراك المدفوع المؤهل.',
  },
  {
    q: 'هل يمكن استخدام الإحالة الذاتية؟',
    a: 'لا، يتم حظر أي إحالة ذاتية أو أنماط احتيال، ولا تُعتمد ضمن العمولة.',
  },
];

export default function SuccessPartnersPage() {
  return (
    <>
      <Section className="pb-10 pt-16 sm:pt-20">
        <Container className="space-y-6 text-center">
          <p className="inline-flex rounded-full border border-brand-border bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            برنامج التسويق بالعمولة
          </p>
          <h1 className="text-4xl font-extrabold text-brand-navy sm:text-5xl dark:text-slate-100">شركاء النجاح</h1>
          <p className="mx-auto max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">
            برنامج احترافي للمسوقين المستقلين وصنّاع النمو. ساعد مكاتب المحاماة على الوصول لمسار المحامي واحصل على عمولة واضحة على كل اشتراك مدفوع مؤهل.
          </p>
        </Container>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">كيف يعمل البرنامج؟</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-emerald/15 text-xs font-bold text-brand-emerald">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-xl2 border border-brand-border bg-brand-background p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">نموذج العمولة</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <strong>عمولة الشريك:</strong> 5%
              </p>
              <p>
                تعتمد العمولة فقط على عمليات الدفع الناجحة المؤكدة من بوابة الدفع، ويتم استبعاد أي طلبات ملغية أو مردودة أو غير مؤهلة.
              </p>
            </div>
          </article>
        </div>
      </Section>

      <Section title="الأسئلة الشائعة" className="bg-white dark:bg-slate-950">
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-xl2 border border-brand-border p-5 dark:border-slate-700">
              <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">{item.q}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.a}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="partners-apply" title="نموذج التقديم" subtitle="أدخل بياناتك بدقة وسيتم الرد عليك بعد المراجعة.">
        <SuccessPartnersForm />
      </Section>
    </>
  );
}
