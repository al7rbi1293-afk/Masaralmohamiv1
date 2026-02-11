'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';

type WidgetBucket = {
  count: number;
  items: Array<{ id: string; title?: string; number?: string; dueDate?: string; updatedAt?: string }>;
};

type DashboardResponse = {
  overdueTasks: WidgetBucket;
  upcomingDeadlines: WidgetBucket;
  staleMatters: WidgetBucket;
  unpaidInvoices: WidgetBucket;
};

type DashboardPageProps = {
  params: {
    tenantId: string;
  };
};

export default function DashboardPage({ params }: DashboardPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<DashboardResponse>(session, '/dashboard/widgets')
      .then(setData)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل لوحة التحكم');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  const cards = [
    { title: 'المهام المتأخرة', value: data?.overdueTasks.count ?? 0 },
    { title: 'المواعيد خلال 7 أيام', value: data?.upcomingDeadlines.count ?? 0 },
    { title: 'القضايا الراكدة 14 يوم', value: data?.staleMatters.count ?? 0 },
    { title: 'الفواتير غير المسددة', value: data?.unpaidInvoices.count ?? 0 },
  ];

  return (
    <PortalPage
      title="لوحة التحكم"
      description="نظرة سريعة على أهم مؤشرات المكتب (مهام، مواعيد، قضايا، وفواتير)."
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-brand-navy dark:text-slate-100">{card.value}</p>
          </article>
        ))}
      </div>
    </PortalPage>
  );
}
