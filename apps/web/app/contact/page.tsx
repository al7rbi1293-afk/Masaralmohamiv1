import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { ContactForm } from '@/components/sections/contact-form';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { Section } from '@/components/ui/section';
import { CUSTOMER_SERVICE_WHATSAPP_LINK, CUSTOMER_SERVICE_WHATSAPP_NUMBER, SUPPORT_EMAIL } from '@/lib/support';

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description: 'تواصل مع فريق مسار المحامي للدعم الفني، الخصوصية، أو البلاغات الأمنية.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'تواصل معنا | مسار المحامي',
    description: 'قنوات التواصل الرسمية لمنصة مسار المحامي.',
    url: '/contact',
  },
};

const contactCards = [
  {
    title: 'البريد الإلكتروني',
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    valueDir: 'ltr' as const,
    icon: <Mail size={18} className="text-brand-emerald" />,
  },
  {
    title: 'واتساب خدمة العملاء',
    value: CUSTOMER_SERVICE_WHATSAPP_NUMBER,
    href: CUSTOMER_SERVICE_WHATSAPP_LINK,
    valueDir: 'ltr' as const,
    external: true,
    icon: <WhatsAppIcon className="h-[18px] w-[18px] text-[#25D366]" />,
  },
];

type ContactPageProps = {
  searchParams?: {
    topic?: string | string[];
  };
};

function getDefaultMessage(topic?: string) {
  if (topic === 'demo') {
    return 'أرغب بحجز عرض سريع (10 دقائق).';
  }

  if (topic === 'activation') {
    return 'أرغب بتفعيل النسخة الكاملة.';
  }

  return '';
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  const topic = Array.isArray(searchParams?.topic) ? searchParams?.topic[0] : searchParams?.topic;
  const defaultMessage = getDefaultMessage(topic);

  return (
    <Section
      titleAs="h1"
      title="تواصل معنا"
      subtitle="يسعدنا الرد على أسئلتك حول المنصة، الأمان، أو الانضمام للنسخة الأولى."
    >
      <div className="mx-auto max-w-md">
        {contactCards.map((card) => (
          <article
            key={card.href}
            className="rounded-xl2 border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-background dark:bg-slate-800">
              {card.icon}
            </div>
            <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">{card.title}</h2>
            <a
              href={card.href}
              target={card.external ? '_blank' : undefined}
              rel={card.external ? 'noreferrer' : undefined}
              dir={card.valueDir}
              className="mt-2 inline-block text-sm text-slate-700 hover:text-brand-emerald dark:text-slate-300"
            >
              {card.value}
            </a>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <ContactForm defaultMessage={defaultMessage} />
      </div>
    </Section>
  );
}
