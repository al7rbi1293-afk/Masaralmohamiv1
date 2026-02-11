'use client';

import { ReactNode } from 'react';
import { PortalNav } from '@/components/portal/portal-nav';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { Container } from '@/components/ui/container';

type TenantLayoutProps = {
  children: ReactNode;
  params: {
    tenantId: string;
  };
};

export default function TenantLayout({ children, params }: TenantLayoutProps) {
  const { session, loading } = useSessionGuard(params.tenantId);

  if (loading || !session) {
    return (
      <Container className="py-16">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          جارٍ تحميل مساحة المكتب...
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <PortalNav tenantId={params.tenantId} user={session.user} />
        <div>{children}</div>
      </div>
    </Container>
  );
}
