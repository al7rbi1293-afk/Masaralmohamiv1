import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileLock2,
  FileStack,
  Landmark,
  Layers3,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { SUBSCRIPTION_PRICING_CARDS } from '@/lib/subscription-pricing';
import { getPublicSiteUrl } from '@/lib/env';

const siteUrl = getPublicSiteUrl();
const canonicalUrl = `${siteUrl}/investors`;

export const metadata: Metadata = {
  title: 'للمستثمرين',
  description:
    'ملف استثماري مختصر عن مسار المحامي: منصة SaaS عربية لإدارة مكاتب المحاماة مع تسعير جاهز، بوابة عميل، تكاملات ناجز، ومساعد قانوني ذكي.',
  alternates: {
    canonical: canonicalUrl,
  },
  openGraph: {
    title: 'مسار المحامي | ملف المستثمرين',
    description:
      'منصة تشغيل متخصصة لمكاتب المحاماة في السعودية: إدارة تشغيلية، تسعير SaaS، توسع Enterprise، وتكاملات قانونية محلية.',
    url: canonicalUrl,
    images: ['/masar-logo.png'],
  },
};

type IconCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type BulletCard = IconCard & {
  bullets: string[];
};

const snapshotStats = [
  {
    value: '38',
    label: 'إجمالي المكاتب',
    note: 'كما يظهر في لوحة الإدارة داخل المنصة.',
  },
  {
    value: '44',
    label: 'إجمالي المستخدمين',
    note: 'عدد الحسابات الظاهر في النظرة العامة على النظام.',
  },
  {
    value: '3',
    label: 'الاشتراكات الفعالة',
    note: 'الاشتراكات الحالية الظاهرة داخل لوحة الإدارة.',
  },
  {
    value: '35',
    label: 'النسخ التجريبية',
    note: 'إحصائيات مباشرة من لوحة الإدارة لآخر 30 يومًا.',
  },
];

const thesisCards: BulletCard[] = [
  {
    title: 'مشكلة تشغيلية متكررة',
    description: 'المكتب القانوني العربي ما زال يوزع العمل بين ملفات متفرقة ورسائل ومتابعات يدوية.',
    icon: Workflow,
    bullets: [
      'القضية تتشتت بين مستندات ومحادثات ومهام منفصلة.',
      'المتابعة مع العميل والفريق والتحصيل تتحول إلى جهد يدوي يومي.',
      'غياب سجل موحد يبطئ القرار ويزيد الأخطاء التشغيلية.',
    ],
  },
  {
    title: 'حل عمودي واضح',
    description: 'مسار المحامي ليس أداة عامة؛ بل طبقة تشغيل كاملة مصممة لمكتب المحاماة العربي.',
    icon: Building2,
    bullets: [
      'إدارة عملاء وقضايا ومستندات ومهام وفواتير من مكان واحد.',
      'واجهة RTL عربية أولًا بدل حلول مترجمة أو معقدة.',
      'صلاحيات وسجل تدقيق وعزل بيانات ملائم لمتطلبات الحساسية القانونية.',
    ],
  },
  {
    title: 'توسع طبيعي عالي القيمة',
    description: 'المنتج الحالي يفتح مسارات توسع داخل الحساب نفسه بدل بيع منتج واحد فقط.',
    icon: TrendingUp,
    bullets: [
      'بوابة عميل تزيد الشفافية وترفع التفاعل والتحصيل.',
      'نسخة شركات بتكاملات Najiz تمثل wedge مؤسسي محلي.',
      'Legal Copilot يضيف طبقة AI فوق المستندات والمعرفة القانونية.',
    ],
  },
];

const productPillars: BulletCard[] = [
  {
    title: 'العمليات الأساسية للمكتب',
    description: 'العمود الفقري اليومي للعمل القانوني.',
    icon: Briefcase,
    bullets: [
      'إدارة العملاء والقضايا والمعاملات والعضويات الخاصة.',
      'لوحات مهام وتقويم ومتابعة للإجراءات القادمة.',
      'تقارير تشغيلية أساسية وحالة المكتب من لوحة واحدة.',
    ],
  },
  {
    title: 'المستندات والنسخ والمشاركة',
    description: 'تنظيم يحترم حساسية الملف القانوني.',
    icon: FileStack,
    bullets: [
      'إصدارات متعددة للمستندات مع تاريخ واضح.',
      'روابط مشاركة مؤقتة وتحكم أدق في الوصول.',
      'بحث وفهرسة وأرشفة تخفف الاعتماد على المجلدات اليدوية.',
    ],
  },
  {
    title: 'الفوترة والتحصيل',
    description: 'ربط أوضح بين العمل القانوني والدخل.',
    icon: CircleDollarSign,
    bullets: [
      'عروض أسعار وفواتير وملفات PDF قابلة للتصدير.',
      'متابعة المدفوع والمتأخر ضمن نفس السياق التشغيلي.',
      'تمهيد عملي لرفع انضباط التحصيل داخل المكتب.',
    ],
  },
  {
    title: 'بوابة العميل',
    description: 'طبقة B2B2C تزيد قيمة الحساب نفسه.',
    icon: Users,
    bullets: [
      'دخول OTP بالبريد مع ضوابط واضحة للجلسات.',
      'عرض القضايا والمستندات والفواتير المصرح بها فقط.',
      'مستهدفات تشغيلية معلنة لخفض الاستفسارات ورفع السداد.',
    ],
  },
  {
    title: 'Legal Copilot',
    description: 'مساعد قانوني متصل بالمعرفة والملفات وليس chatbot عام.',
    icon: Sparkles,
    bullets: [
      'خط معالجة للمستندات يبدأ بالاستخراج وينتهي بالتقسيم والفهرسة.',
      'استرجاع معرفي على مستوى القضية والمعرفة القانونية.',
      'مسار قابل للتوسع إلى توليد المسودات والإجراءات الذكية.',
    ],
  },
  {
    title: 'نسخة الشركات + Najiz',
    description: 'مدخل مؤسسي محلي يصعب نسخه بسرعة.',
    icon: Landmark,
    bullets: [
      'تكامل مؤسسي محصور للباقات العالية فقط.',
      'أتمتة مزامنة القضايا والمستندات والطلبات في الخلفية.',
      'طبقة مراقبة ودعم للإطلاق المرحلي الآمن.',
    ],
  },
];

const growthLanes: IconCard[] = [
  {
    title: 'اشتراك ذاتي',
    description: 'باقات شهرية واضحة من 250 إلى 750 ريال لالتقاط المكاتب الصغيرة والمتوسطة بسرعة.',
    icon: CircleDollarSign,
  },
  {
    title: 'توسع الشركات',
    description: 'نسخة الشركات تضيف تكاملات حكومية ورحلات عمل مخصصة بدل سقف تسعيري منخفض.',
    icon: Building2,
  },
  {
    title: 'توسع الاحتفاظ',
    description: 'بوابة العميل والدفع والمستندات تجعل المنتج أقرب للنظام الأساسي للمكتب لا مجرد أداة جانبية.',
    icon: Target,
  },
  {
    title: 'نمو عبر الشركاء',
    description: 'برنامج شركاء النجاح يحول الإحالات إلى قناة اكتساب قابلة للتكرار ومربوطة بالدفع الفعلي.',
    icon: Network,
  },
];

const moatCards: BulletCard[] = [
  {
    title: 'مواءمة محلية قوية',
    description: 'الترجمة وحدها لا تكفي في هذا السوق.',
    icon: Layers3,
    bullets: [
      'واجهة عربية RTL من الأساس.',
      'مصطلحات تشغيلية أقرب لواقع المكتب المحلي.',
      'خطة Enterprise مرتبطة بـ Najiz لا بسوق عام فقط.',
    ],
  },
  {
    title: 'ثقة وأمن من البداية',
    description: 'المنتج بُني بعقلية نظام حساس لا بعقلية صفحة SaaS بسيطة.',
    icon: ShieldCheck,
    bullets: [
      'عزل بيانات على مستوى المكتب مع RLS وسياسات وصول.',
      'سجل تدقيق للعمليات الحساسة.',
      'Security headers وrate limiting وخط أساس مراقبة واضح.',
    ],
  },
  {
    title: 'عمق منتجي حقيقي',
    description: 'اتساع الوحدات يقلل فرصة الاستبدال بأداة واحدة منافسة.',
    icon: FileLock2,
    bullets: [
      'تشغيل داخلي + فوترة + مستندات + بوابة عميل.',
      'تكاملات مؤسسية + AI + قوالب قانونية.',
      'رحلة استخدام تمتد من الاكتساب إلى التحصيل والاحتفاظ.',
    ],
  },
  {
    title: 'جاهزية تنفيذية',
    description: 'المنصة ليست مجرد نموذج أولي؛ بل قاعدة قابلة للإطلاق والقياس.',
    icon: CheckCircle2,
    bullets: [
      'خطة Pilot لأول 10 مكاتب.',
      'Go-live checklist وhealth endpoint ومراقبة أخطاء عبر Sentry.',
      'تفصيل واضح للمراحل التالية بدل وعود غير قابلة للتنفيذ.',
    ],
  },
];

const executionChecklist = [
  'مسار التجربة واكتساب العملاء يعمل حاليًا مع تحويل مباشر إلى المنصة.',
  'إدارة تشغيل المكتب الأساسية موجودة في الإنتاج التطويري: عملاء، قضايا، مهام، مستندات، فواتير، تقارير.',
  'بوابة العميل لها نطاق MVP ومعايير قبول ومؤشرات نجاح واضحة.',
  'برنامج شركاء النجاح مربوط بالإحالة والدفع الفعلي عبر Tap.',
  'نسخة الشركات وتحكم Najiz لها خطة إطلاق وتشغيل ومراقبة مستقلة.',
];

const targetMetrics = [
  {
    value: '30%',
    label: 'خفض مستهدف للاستفسارات اليدوية',
    note: 'مذكور كهدف 60-90 يوم لبوابة العميل.',
  },
  {
    value: '15-25%',
    label: 'تحسن مستهدف في سداد الفواتير',
    note: 'ضمن وثيقة نطاق بوابة العميل.',
  },
  {
    value: '50%+',
    label: 'معدل دخول شهري مستهدف للعملاء المدعوين',
    note: 'هدف تبنٍ لمرحلة ما بعد الإطلاق.',
  },
  {
    value: '5%',
    label: 'عمولة الشريك الافتراضية',
    note: 'مرتبطة فقط بالدفع الناجح الفعلي.',
  },
];

const founderFacts = [
  {
    label: 'الاسم',
    value: 'عبدالعزيز فهد عطية الحازمي',
    note: 'المؤسس والقائد التنفيذي الحالي للمشروع.',
  },
  {
    label: 'وضع الفريق الحالي',
    value: 'Founder-led',
    note: 'النسخة الحالية يقودها المؤسس مباشرة مع نموذج تشغيل نحيف ومركز.',
  },
  {
    label: 'المرجعية المهنية',
    value: 'وثيقة العمل الحر',
    note: 'صادرة من وزارة الموارد البشرية والتنمية الاجتماعية.',
  },
  {
    label: 'رقم الوثيقة',
    value: 'FL-665098602',
    note: 'استُخدمت هنا لأغراض التعريف المهني فقط دون عرض رقم الهوية.',
  },
  {
    label: 'التخصص المسجل',
    value: 'المساعدة الإدارية',
    note: 'ضمن فئة الخدمات التخصصية في الوثيقة المرفقة.',
  },
  {
    label: 'انتهاء الوثيقة',
    value: '15 مارس 2027',
    note: 'مرجع مهني داعم ضمن المادة الاستثمارية الحالية.',
  },
];

const fundingUse = [
  '40% تطوير المنتج والهندسة وسير العمل القانوني الذكي.',
  '25% اكتساب العملاء، التجارب الأولى، وبناء قنوات البيع.',
  '15% تكاملات نسخة الشركات والامتثال والتشغيل المؤسسي.',
  '10% بنية تحتية واستضافة ودعم تشغيلي.',
  '10% تصميم ومساندة تشغيلية وقانونية وإدارية.',
];

const fundingOutcomes = [
  'تحويل الجاهزية التقنية الحالية إلى قصة تبنٍ موثقة داخل السوق.',
  'توسيع الفريق من نموذج founder-led إلى نواة تنفيذية قابلة للتكرار.',
  'إثبات قناة اكتساب أولية مع مكاتب مدفوعة ونسخة شركات قيد التفعيل.',
  'رفع جودة البيانات والاحتفاظ وتجربة المنتج قبل أي جولة أكبر لاحقًا.',
];

export default function InvestorsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.26),_transparent_26%),radial-gradient(circle_at_80%_18%,_rgba(59,130,246,0.2),_transparent_24%),linear-gradient(180deg,_#06111f_0%,_#091728_46%,_#0b1f3b_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <Container className="relative pb-14 pt-16 sm:pb-20 sm:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-medium tracking-[0.18em] text-emerald-200">
                INVESTOR PORTFOLIO
              </p>
              <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                مسار المحامي
                <span className="mt-3 block text-2xl font-semibold text-slate-200 sm:text-3xl">
                  منصة SaaS عربية متخصصة لتشغيل مكاتب المحاماة والنمو داخل السوق السعودي
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                الفكرة الاستثمارية هنا واضحة: منتج عمودي بُني فعلًا حول سير العمل القانوني اليومي،
                مع تسعير جاهز، قاعدة أمنية مناسبة، ومسارات توسع عالية القيمة عبر بوابة العميل،
                Enterprise Najiz، وLegal Copilot.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contact" className={buttonVariants('primary', 'lg')}>
                  تواصل بخصوص الاستثمار
                </Link>
                <Link
                  href="#business-model"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-base font-medium text-white transition hover:bg-white/10"
                >
                  استعرض نموذج النمو
                  <ArrowUpLeft size={18} />
                </Link>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-400">
                جميع الأرقام في هذه الصفحة مأخوذة من التهيئة والوثائق الحالية داخل المشروع، وليست
                ادعاءات traction سوقي غير موثقة.
              </p>
            </div>

            <aside className="rounded-[1.75rem] border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold text-emerald-200">الملخص التنفيذي</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm text-slate-300">الفئة</p>
                  <p className="mt-1 text-lg font-semibold">Vertical SaaS قانوني لمكاتب المحاماة</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm text-slate-300">النواة الحالية</p>
                  <p className="mt-1 text-lg font-semibold">
                    تشغيل المكتب، المستندات، الفوترة، المهام، التقارير، والصلاحيات
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm text-slate-300">مسارات التوسع</p>
                  <p className="mt-1 text-lg font-semibold">
                    بوابة عميل، Najiz Enterprise، شراكات إحالة، وLegal Copilot
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
                المنتج جاهز لأن يُعرض كمشروع جاد: المشكلة واضحة، البناء موجود، نموذج الإيراد ظاهر،
                وخارطة الطريق مرتبطة بما هو مطبق فعليًا داخل الكود.
              </div>
            </aside>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {snapshotStats.map((item) => (
              <article
                key={item.label}
                className="rounded-[1.5rem] border border-white/10 bg-white/8 p-5 shadow-lg backdrop-blur"
              >
                <p className="text-3xl font-bold text-white">{item.value}</p>
                <p className="mt-3 text-sm font-semibold text-slate-100">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.note}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <Section
        id="investor-highlights"
        title="أطروحة الاستثمار"
        subtitle="هذه ليست قصة عرض شرائح فقط؛ بل قراءة مباشرة لما بُني داخل المنتج وما يمكن أن يتوسع منه."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {thesisCards.map(({ title, description, bullets, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[1.5rem] border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy dark:bg-slate-800 dark:text-slate-100">
                  <Icon size={20} />
                </span>
                <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-emerald" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="الطبقات التي بُنيت داخل المنتج"
        subtitle="كل بطاقة أدناه تمثل مجالًا حاضرًا في الشيفرة والوثائق الحالية، لا مجرد أفكار على خارطة طريق."
        className="bg-white dark:bg-slate-950"
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {productPillars.map(({ title, description, bullets, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[1.5rem] border border-brand-border bg-brand-background p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-brand-emerald">
                  <Icon size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 shrink-0 text-brand-emerald" size={16} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="business-model"
        title="كيف ينمو هذا المشروع"
        subtitle="نقطة القوة هنا أن الإيراد والتوسع والاحتفاظ كلها مرتبطة بنفس المنتج الأساسي."
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {growthLanes.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy dark:bg-slate-800 dark:text-slate-100">
                  <Icon size={20} />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
              </article>
            ))}
          </div>

          <div className="rounded-[1.75rem] border border-brand-border bg-slate-950 p-6 text-white dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-200">التسعير الحالي في المنتج</p>
                <h2 className="mt-2 text-2xl font-bold">طبقات دخل واضحة من أول يوم</h2>
              </div>
              <Clock3 className="shrink-0 text-emerald-300" size={24} />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {SUBSCRIPTION_PRICING_CARDS.map((plan) => (
                <article
                  key={plan.code}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <p className="text-sm text-slate-300">{plan.title}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{plan.priceLabel}</p>
                  <p className="mt-1 text-sm text-emerald-200">{plan.periodLabel || 'مبيعات مباشرة'}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description}</p>
                  <p className="mt-3 text-xs font-medium tracking-wide text-slate-400">{plan.seatsLabel}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              هذا التسعير مهم استثماريًا لأنه يجمع بين self-serve منخفض الاحتكاك من جهة، ومسار
              Enterprise أعلى قيمة من جهة أخرى.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="لماذا يصعب استبدال المنتج"
        subtitle="ميزة المشروع ليست في صفحة واحدة أو خاصية واحدة، بل في تراكب عدة مزايا محلية وتشغيلية معًا."
        className="bg-white dark:bg-slate-950"
      >
        <div className="grid gap-5 md:grid-cols-2">
          {moatCards.map(({ title, description, bullets, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[1.5rem] border border-brand-border p-6 shadow-panel dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-emerald/10 text-brand-emerald">
                  <Icon size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-navy dark:bg-slate-200" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="جاهزية التنفيذ الحالية"
        subtitle="المشروع يملك أساسًا مناسبًا لحديث استثماري جاد: بناء فعلي، مسار إطلاق، ومؤشرات نجاح محددة."
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.75rem] border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy dark:bg-slate-800 dark:text-slate-100">
                <Target size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-brand-navy dark:text-slate-100">ما هو موجود اليوم</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  نقاط تنفيذية يمكن الحديث عنها بثقة أمام المستثمر.
                </p>
              </div>
            </div>
            <ol className="mt-6 space-y-4">
              {executionChecklist.map((item, index) => (
                <li key={item} className="flex items-start gap-4">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-emerald/10 text-sm font-bold text-brand-emerald">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{item}</p>
                </li>
              ))}
            </ol>
          </article>

          <article className="rounded-[1.75rem] border border-brand-border bg-brand-background p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-brand-emerald">
                <TrendingUp size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-brand-navy dark:text-slate-100">مستهدفات ما بعد الإطلاق</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  هذه مستهدفات تشغيلية معلنة داخل الوثائق وليست نتائج سوقية نهائية بعد.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {targetMetrics.map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-brand-border bg-white p-5 dark:border-slate-700 dark:bg-slate-950"
                >
                  <p className="text-3xl font-bold text-brand-navy dark:text-slate-100">{item.value}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.note}</p>
                </article>
              ))}
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="المؤسس والفريق الحالي"
        subtitle="النسخة الحالية يقودها المؤسس مباشرة، وهذا مهم استثماريًا لأنه يوضح سرعة التنفيذ الحالية وما الذي سيُبنى بالتمويل."
        className="bg-white dark:bg-slate-950"
      >
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.75rem] border border-brand-border bg-slate-950 p-6 text-white shadow-panel dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-200">
                <Users size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold">عبدالعزيز فهد عطية الحازمي</h2>
                <p className="mt-1 text-sm text-slate-300">المؤسس والقائد التنفيذي الحالي للمشروع</p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-8 text-slate-300">
              المشروع اليوم في مرحلة <span className="font-semibold text-white">founder-led</span>:
              المؤسس يقود البناء، السرد الاستثماري، وتجهيز المسار التجاري الأولي. هذا يمنح المشروع
              سرعة قرار وتنفيذ عالية، ويجعل استخدام التمويل واضحًا: توسيع الفريق وبناء طبقة
              go-to-market أكثر اتساعًا بدل صرف رأس المال على تعقيد مبكر.
            </p>
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
              تم استخدام بيانات وثيقة العمل الحر هنا كمرجعية مهنية داعمة فقط، دون عرض أي بيانات
              شخصية حساسة داخل المادة الاستثمارية.
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {founderFacts.map((item) => (
              <article
                key={item.label}
                className="rounded-[1.5rem] border border-brand-border bg-brand-background p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-3 text-lg font-semibold text-brand-navy dark:text-slate-100">{item.value}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="الطرح المقترح واستخدام الأموال"
        subtitle="النسخة الحالية مبنية على سيناريو تمويلي عملي للمرحلة الحالية: تمويل تنفيذ منضبط لمدة 12 شهرًا، لا توسع عشوائي."
      >
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <article className="rounded-[1.75rem] border border-brand-border bg-slate-950 p-6 text-white shadow-panel dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-200">
                <CircleDollarSign size={20} />
              </span>
              <div>
                <h2 className="text-xl font-semibold">1.2 مليون ريال سعودي</h2>
                <p className="mt-1 text-sm text-slate-300">تمويل تشغيلي مستهدف لمدة 12 شهرًا</p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-8 text-slate-300">
              هذا الرقم مقترح أولي مناسب للمرحلة الحالية. الهدف منه ليس رفع الحرق التشغيلي بسرعة،
              بل تحويل الجاهزية الحالية إلى مؤشرات تبنٍ وإيراد واحتفاظ أوضح خلال نافذة تنفيذ
              منضبطة.
            </p>
          </article>

          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-[1.75rem] border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy dark:bg-slate-800 dark:text-slate-100">
                  <CircleDollarSign size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-brand-navy dark:text-slate-100">استخدام الأموال</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    توزيع عملي مبني على ما يحتاجه المشروع في هذه المرحلة.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {fundingUse.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 shrink-0 text-brand-emerald" size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[1.75rem] border border-brand-border bg-brand-background p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-brand-emerald">
                  <Target size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-brand-navy dark:text-slate-100">المخرجات المستهدفة</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    ما الذي يفترض أن يحققه هذا التمويل عمليًا خلال الجولة.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {fundingOutcomes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-navy dark:bg-slate-200" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(22,163,74,0.24),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.04),_transparent_50%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold tracking-[0.18em] text-emerald-200">INVESTOR READY</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                ملف استثماري موحّد بين الموقع والمواد القابلة للإرسال للمستثمر
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-300">
                هذه الصفحة الآن تعكس نفس السرد الموجود في النسخة النهائية للمستثمرين: `traction`
                الحالي، المؤسس، والطرح المقترح واستخدام الأموال، بصياغة صادقة مبنية على البيانات
                المتاحة داخل المشروع.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className={buttonVariants('primary', 'lg')}>
                افتح قناة تواصل
              </Link>
              <Link href="/" className={buttonVariants('outline', 'lg')}>
                العودة للموقع
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
