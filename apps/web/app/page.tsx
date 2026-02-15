import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Briefcase,
  CalendarClock,
  FileLock2,
  FileStack,
  FolderKanban,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { FeatureCard } from '@/components/sections/feature-card';
import { FAQAccordion } from '@/components/sections/faq-accordion';
import { StartTrialForm } from '@/components/sections/start-trial-form';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'الرئيسية',
  description:
    'مسار المحامي: نظام سحابي عربي لإدارة مكتب المحاماة على مسار واحد، مع واجهة بسيطة وصلاحيات وسجل تدقيق.',
  openGraph: {
    title: 'مسار المحامي',
    description:
      'نظام سحابي عربي يلمّ شغل المكتب في مكان واحد: عملاء، قضايا، مستندات، مهام، وفواتير.',
    url: '/',
  },
};

const valuePills = [
  'لا موعد يضيع',
  'ملفات مرتبة + نسخ وإصدارات',
  'مشاركة آمنة بروابط مؤقتة',
  'صلاحيات فريق + سجل تدقيق',
  'تقارير سريعة للإدارة والتحصيل',
];

const problemBullets = [
  'ملفات متكررة بأسماء مختلفة',
  'تحديث القضية برسائل متفرقة',
  'مهل وجلسات قد تُنسى تحت ضغط العمل',
  'تحصيل الأتعاب بدون رؤية واضحة',
];

const scenarios = [
  {
    title: 'قبل الجلسة بدقيقتين...',
    text: 'تدخل القضية وتلقى آخر إجراء، موعد الجلسة، والمستندات الأساسية في شاشة واحدة بدل البحث بين محادثات ومجلدات.',
  },
  {
    title: 'العميل يطلب نسخة مستند...',
    text: 'تنشئ رابط مشاركة مؤقت ينتهي تلقائيًا. مشاركة أسرع، أمان أعلى، وتتبع واضح لما تم عرضه.',
  },
  {
    title: 'نهاية الأسبوع...',
    text: 'تراجع المهام المتأخرة، القضايا الراكدة، والفواتير غير المسددة خلال دقائق بدل جمع البيانات يدويًا.',
  },
];

const features = [
  {
    title: 'إدارة القضايا والمعاملات',
    icon: <FolderKanban size={18} />,
    bullets: [
      'ملف قضية موحد يجمع كل التفاصيل',
      'حالات واضحة لكل قضية ومعاملة',
      'تعيين المسؤولين وأعضاء الفريق بسهولة',
    ],
  },
  {
    title: 'المستندات بترتيب مكتب محترف',
    icon: <FileStack size={18} />,
    bullets: [
      'مجلدات وعلامات لسرعة الوصول',
      'نسخ وإصدارات بدون فقدان التاريخ',
      'بحث مباشر داخل أرشيف المكتب',
    ],
  },
  {
    title: 'مهام وتذكيرات',
    icon: <CalendarClock size={18} />,
    bullets: [
      'مواعيد استحقاق وتنبيهات دقيقة',
      'متابعة ما تم وما تبقى على الفريق',
      'لوحة مهام تركّز على الأولويات',
    ],
  },
  {
    title: 'فوترة مبسطة',
    icon: <ReceiptText size={18} />,
    bullets: [
      'عروض أسعار وفواتير بخطوات قليلة',
      'متابعة المدفوع وغير المدفوع فورًا',
      'وضوح أكبر في التحصيل والتدفق النقدي',
    ],
  },
  {
    title: 'صلاحيات + سجل تدقيق',
    icon: <ShieldCheck size={18} />,
    bullets: [
      'أدوار وصلاحيات حسب مهام الفريق',
      'سجل تدقيق لكل عملية حساسة',
      'عزل بيانات كل مكتب بشكل مستقل',
    ],
  },
];

const faqs = [
  {
    question: 'هل البيانات معزولة لكل مكتب؟',
    answer: 'نعم، كل مكتب يعمل في مساحة مستقلة مع عزل بيانات كامل وسياسات وصول واضحة.',
  },
  {
    question: 'هل أقدر أخلي قضية خاصة؟',
    answer: 'نعم، يمكن تحديد قضايا خاصة وتقييد الوصول عليها لأعضاء محددين فقط.',
  },
  {
    question: 'هل مشاركة المستندات آمنة؟',
    answer: 'نعم، المشاركة تتم بروابط مؤقتة تنتهي تلقائيًا مع حماية على مستوى الملفات.',
  },
  {
    question: 'هل يدعم العربية RTL؟',
    answer: 'نعم، الواجهة عربية أولًا وباتجاه RTL بشكل كامل.',
  },
  {
    question: 'هل أقدر أستورد بيانات؟',
    answer: 'نعم، خيارات الاستيراد متاحة ضمن خطة التفعيل الأولية للمكاتب.',
  },
  {
    question: 'هل فيه تطبيق جوال؟',
    answer: 'ضمن خارطة الطريق، مع تركيز حالي على تجربة الويب الكاملة للمكتب.',
  },
];

export default function HomePage() {
  return (
    <>
      <Section className="pb-8 pt-16 sm:pt-24">
        <Container className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center rounded-full border border-brand-border bg-white px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              SaaS عربي لمكاتب المحاماة
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-brand-navy sm:text-5xl dark:text-slate-100">
              مسار المحامي
            </h1>
            <p className="mt-3 text-xl font-semibold text-slate-700 dark:text-slate-200">
              إدارة مكتب المحاماة… على مسار واحد.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              نظام سحابي عربي يلمّ شغل المكتب في مكان واحد: عملاء • قضايا • مستندات • مهام • فواتير —
              بواجهة بسيطة وصلاحيات وسجل تدقيق يحمي المكتب.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="#trial" className={buttonVariants('primary', 'lg')}>
                برمج مكتبك الآن
              </Link>
              <Link
                href="/signin"
                className={buttonVariants('outline', 'lg')}
              >
                دخول الإدارة
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              بدون بطاقة — إعداد خلال دقائق — عربي RTL
            </p>
          </div>

          <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">ملخص المكتب الآن</h2>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-brand-background px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-300">المهام المتأخرة</span>
                <span className="text-lg font-bold text-brand-navy dark:text-slate-100">4</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-brand-background px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-300">قضايا تحتاج متابعة</span>
                <span className="text-lg font-bold text-brand-navy dark:text-slate-100">7</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-brand-background px-4 py-3 dark:bg-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-300">فواتير غير مسددة</span>
                <span className="text-lg font-bold text-brand-navy dark:text-slate-100">12</span>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="py-8">
        <Container>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {valuePills.map((pill) => (
              <div
                key={pill}
                className="rounded-full border border-brand-border bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {pill}
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section
        id="trial"
        title="نسخة كاملة… ادفع لاحقاً"
        subtitle="سجّل بياناتك وسيتم نقلك مباشرة إلى المنصة التجريبية."
        className="scroll-mt-28 bg-white dark:bg-slate-950"
      >
        <StartTrialForm />
      </Section>

      <Section className="bg-white dark:bg-slate-950">
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-xl2 border border-brand-border p-6 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
              إذا تشتتت أدواتك… تشتتت قضاياك
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {problemBullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl2 border border-brand-border bg-brand-background p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
              مسار المحامي يختصرها: افتح القضية وشوف كل شيء
            </h2>
            <p className="mt-5 text-sm leading-8 text-slate-700 dark:text-slate-300">
              ملخص واحد يجاوبك فورًا: وش صار آخر شيء؟ وش القادم؟ وين المستند؟ مين المسؤول؟ وش
              وضع الفواتير؟
            </p>
          </article>
        </div>
      </Section>

      <Section title="سيناريوهات يومية" subtitle="من واقع ضغط العمل داخل المكتب.">
        <div className="grid gap-4 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <article
              key={scenario.title}
              className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            >
              <h3 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{scenario.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{scenario.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="ميزات مصممة لسير عمل المحامي">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              bullets={feature.bullets}
              icon={feature.icon}
            />
          ))}
        </div>
      </Section>

      <Section>
        <div className="rounded-2xl bg-brand-navy p-8 text-white sm:p-10">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold sm:text-3xl">المشاركة الآمنة + سجل التدقيق</h2>
            <p className="mt-4 text-sm leading-8 text-slate-200">
              شارك مستند للعميل عبر رابط مؤقت ينتهي تلقائيًا. وللمكتب: سجل تدقيق واضح لأي عملية
              حساسة.
            </p>
            <Link
              href="/security"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-slate-100"
            >
              صفحة الأمان والخصوصية
            </Link>
          </div>
        </div>
      </Section>

      <Section title="لمن صُمم مسار المحامي؟">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'محامي مستقل',
              price: '250 ريال',
              period: 'شهرياً',
              desc: 'انطلاقة قوية لممارستك المستقلة. نظّم قضاياك وعملائك في مكان واحد بمهنية عالية.',
            },
            {
              title: 'مكتب صغير (1-5)',
              price: '500 ريال',
              period: 'شهرياً',
              desc: 'أسس مكتبك على قواعد صحيحة. تعاون مع فريقك وتابع المهام بدقة وسلاسة.',
            },
            {
              title: 'مكتب متوسط (6-25)',
              price: '750 ريال',
              period: 'شهرياً',
              desc: 'تحكم كامل في النمو. صلاحيات متقدمة وتقارير أداء لضبط سير العمل.',
            },
            {
              title: 'مكتب كبير أو شركة محاماة',
              price: 'تواصل معنا',
              period: '',
              desc: 'حلول مخصصة للمؤسسات الكبرى. دعم خاص وتكاملات متقدمة.',
              action: 'email',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-xl2 border border-brand-border bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <Users className="mx-auto text-brand-emerald" size={20} />
              <h3 className="mt-3 text-lg font-semibold text-brand-navy dark:text-slate-100">{item.title}</h3>

              <div className="mt-4 flex items-end justify-center gap-1">
                <span className={`text-2xl font-bold ${item.action === 'email' ? 'text-lg' : 'text-brand-navy dark:text-slate-100'}`}>
                  {item.price}
                </span>
                {item.period && <span className="text-sm text-slate-500 mb-1">{item.period}</span>}
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.desc}
              </p>

              {item.action === 'email' && (
                <a
                  href="mailto:Masar.almohami@outlook.sa"
                  className="mt-4 inline-block text-sm font-medium text-brand-emerald hover:underline"
                >
                  Masar.almohami@outlook.sa
                </a>
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section className="bg-white dark:bg-slate-950">
        <div className="rounded-xl2 border border-brand-border p-8 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-brand-navy dark:text-slate-100">جرّب الآن وادفع لاحقاً</h2>
          <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600 dark:text-slate-300">
            إذا غيّر الموقع حياتك المهنية للأفضل، كمل معنا. نسخة كاملة المزايا لتختبر الفائدة بنفسك.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signin" className={buttonVariants('primary', 'md')}>
              جرّب مجانًا
            </Link>
            <Link href="/signin" className={buttonVariants('outline', 'md')}>
              دخول الإدارة
            </Link>
          </div>
        </div>
      </Section>

      <Section title="الأسئلة الشائعة">
        <FAQAccordion items={faqs} />
      </Section>

      <Section className="pt-0">
        <div className="rounded-2xl border border-brand-border bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-2xl font-bold text-brand-navy dark:text-slate-100">
            خلّ شغلك يمشي على مسار واحد
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signin" className={buttonVariants('primary', 'lg')}>
              جرّب مسار المحامي مجانًا
            </Link>
            <Link href="/signin" className={buttonVariants('outline', 'lg')}>
              دخول الإدارة
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
