'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type TasksResponse = {
  data: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }>;
  total: number;
};

type TasksPageProps = {
  params: {
    tenantId: string;
  };
};

export default function TasksPage({ params }: TasksPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<TasksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<TasksResponse>(session, '/tasks?page=1&pageSize=10')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل المهام');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="المهام" description="متابعة مهام الفريق والمواعيد القادمة.">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي المهام: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا توجد مهام بعد."
        renderItem={(item) =>
          `${item.title} — ${item.status} — ${item.dueDate ? new Date(item.dueDate).toLocaleDateString('ar-SA') : 'بدون تاريخ استحقاق'}`
        }
      />
    </PortalPage>
  );
}
