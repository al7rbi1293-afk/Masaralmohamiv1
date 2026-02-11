'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type MattersResponse = {
  data: Array<{
    id: string;
    title: string;
    status: string;
    client?: { name: string };
    assignee?: { name: string };
  }>;
  total: number;
};

type MattersPageProps = {
  params: {
    tenantId: string;
  };
};

export default function MattersPage({ params }: MattersPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<MattersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<MattersResponse>(session, '/matters?page=1&pageSize=10')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل القضايا');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="القضايا" description="متابعة وضع القضايا الحالية والمسؤول عنها.">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي القضايا: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا توجد قضايا بعد."
        renderItem={(item) =>
          `${item.title} — ${item.status} — العميل: ${item.client?.name ?? 'غير محدد'} — المسؤول: ${item.assignee?.name ?? 'غير محدد'}`
        }
      />
    </PortalPage>
  );
}
