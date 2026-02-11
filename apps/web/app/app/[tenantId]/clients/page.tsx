'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type ClientsResponse = {
  data: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  total: number;
  page: number;
  pageSize: number;
};

type ClientsPageProps = {
  params: {
    tenantId: string;
  };
};

export default function ClientsPage({ params }: ClientsPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<ClientsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<ClientsResponse>(session, '/clients?page=1&pageSize=10')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل العملاء');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="العملاء" description="قائمة العملاء في مكتبك مع بيانات التواصل الأساسية.">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي العملاء: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا يوجد عملاء بعد."
        renderItem={(item) => `${item.name} — ${item.email ?? 'بدون بريد'} — ${item.phone ?? 'بدون جوال'}`}
      />
    </PortalPage>
  );
}
