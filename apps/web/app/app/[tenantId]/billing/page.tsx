'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type BillingResponse = {
  data: Array<{
    id: string;
    number: string;
    status: string;
    total: string;
    client: { name: string };
  }>;
  total: number;
};

type BillingPageProps = {
  params: {
    tenantId: string;
  };
};

export default function BillingPage({ params }: BillingPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<BillingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<BillingResponse>(session, '/billing/invoices?page=1&pageSize=10')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل الفواتير');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="الفوترة" description="الفواتير وحالتها الحالية في المكتب.">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي الفواتير: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا توجد فواتير بعد."
        renderItem={(item) => `${item.number} — ${item.client.name} — ${item.total} SAR — ${item.status}`}
      />
    </PortalPage>
  );
}
