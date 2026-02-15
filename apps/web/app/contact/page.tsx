import type { Metadata } from 'next';
import { Lock, Mail, Shield } from 'lucide-react';
import { ContactForm } from '@/components/sections/contact-form';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description: 'تواصل مع فريق مسار المحامي للدعم الفني، الخصوصية، أو البلاغات الأمنية.',
  openGraph: {
    title: 'تواصل معنا | مسار المحامي',
    description: 'قنوات التواصل الرسمية لمنصة مسار المحامي.',
    url: '/contact',
  },
};

const contactCards = [
  {
    title: 'للتواصل والدعم الفني',
    email: 'Masar.almohami@outlook.sa',
    icon: <Mail size={18} className="text-brand-emerald" />,
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
      title="تواصل معنا"
      subtitle="يسعدنا الرد على أسئلتك حول المنصة، الأمان، أو الانضمام للنسخة الأولى."
    >
      <div className="mx-auto max-w-md">
        {contactCards.map((card) => (
          <article
            key={card.email}
            className="rounded-xl2 border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-background dark:bg-slate-800">
              {card.icon}
            </div>
            <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">{card.title}</h2>
            <a
              href={`mailto:${card.email}`}
              className="mt-2 inline-block text-sm text-slate-700 hover:text-brand-emerald dark:text-slate-300"
            >
              {card.email}
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
