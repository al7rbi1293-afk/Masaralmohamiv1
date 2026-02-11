import type { Metadata } from 'next';
import { LoginForm } from '@/components/portal/login-form';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'دخول الإدارة',
  description: 'تسجيل الدخول إلى لوحة إدارة مكتبك في مسار المحامي.',
  openGraph: {
    title: 'دخول الإدارة | مسار المحامي',
    description: 'ادخل إلى مساحة مكتبك باستخدام Tenant ID والبريد وكلمة المرور.',
    url: '/app/login',
  },
};

type LoginPageProps = {
  searchParams?: {
    tenantId?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Section className="py-16 sm:py-20">
      <LoginForm initialTenantId={searchParams?.tenantId ?? ''} />
    </Section>
  );
}
