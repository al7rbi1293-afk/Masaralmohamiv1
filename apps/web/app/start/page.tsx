import type { Metadata } from 'next';
import { SignupForm } from '@/components/portal/signup-form';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'إنشاء حساب المكتب',
  description: 'ابدأ نسخة مسار المحامي وأنشئ مساحة مكتبك الخاصة خلال دقائق.',
  openGraph: {
    title: 'إنشاء حساب المكتب | مسار المحامي',
    description: 'سجل مكتبك وأنشئ مساحة إدارة خاصة بك في مسار المحامي.',
    url: '/start',
  },
};

export default function StartPage() {
  return (
    <Section className="py-16 sm:py-20">
      <SignupForm />
    </Section>
  );
}
