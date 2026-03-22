import type { Metadata } from 'next';
import { CheckCircle2, ClipboardList, MessagesSquare } from 'lucide-react';
import { LawyerSurveyForm } from '@/components/sections/lawyer-survey-form';
import { Container } from '@/components/ui/container';
import { getPublicSiteUrl } from '@/lib/env';

const siteUrl = getPublicSiteUrl();
const canonicalUrl = `${siteUrl}/survey/lawyers`;

export const metadata: Metadata = {
  title: 'استبيان المحامين',
  description: 'استبيان قصير لمساعدة فريق مسار المحامي على تحسين تجربة المحامين والمكاتب القانونية.',
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'استبيان المحامين | مسار المحامي',
    description: 'شاركنا رأيك في تجربة المنصة واحتياجات مكتبك خلال 3 دقائق فقط.',
    url: canonicalUrl,
    images: ['/masar-logo.png'],
  },
};

const highlights = [
  {
    title: 'قصير وواضح',
    text: 'أسئلة مباشرة تساعدنا نعرف احتياجك الفعلي بدون إطالة.',
    icon: ClipboardList,
  },
  {
    title: 'مبني على تجربة المنصة',
    text: 'يغطي القضايا والمستندات والمهام والفوترة وبوابة العميل والتكاملات.',
    icon: CheckCircle2,
  },
  {
    title: 'يفيد قرار التطوير',
    text: 'إجاباتك تساعدنا نرتب الأولويات ونحسّن التفعيل والدعم والباقات.',
    icon: MessagesSquare,
  },
];

export default function LawyersSurveyPage() {
  return (
    <section className="bg-gradient-to-b from-brand-background via-white to-white py-14 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:py-20">
      <Container className="space-y-10">
        <div className="max-w-3xl space-y-4">
          <p className="inline-flex rounded-full border border-brand-border bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            استبيان المحامين المسجلين في مسار المحامي
          </p>
          <h1 className="text-3xl font-extrabold leading-tight text-brand-navy dark:text-slate-100 sm:text-4xl">
            ساعدنا نبني تجربة أنسب للمحامي والمكتب
          </h1>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-300">
            نراجع حاليًا أولويات التطوير والتفعيل داخل مسار المحامي. هذا الاستبيان مخصص للمحامين
            والمكاتب المسجلين معنا، ولن يستغرق أكثر من 3 دقائق.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-background text-brand-emerald dark:bg-slate-800">
                  <Icon size={18} />
                </div>
                <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{item.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.text}</p>
              </article>
            );
          })}
        </div>

        <LawyerSurveyForm />
      </Container>
    </section>
  );
}
