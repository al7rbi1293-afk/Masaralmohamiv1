'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type DocumentsResponse = {
  data: Array<{
    id: string;
    title: string;
    versions: Array<{ version: number; mimeType: string; size: number }>;
  }>;
  total: number;
};

type DocumentsPageProps = {
  params: {
    tenantId: string;
  };
};

export default function DocumentsPage({ params }: DocumentsPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<DocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<DocumentsResponse>(session, '/documents?page=1&pageSize=10')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل المستندات');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="المستندات" description="مستندات المكتب وإصداراتها الأخيرة.">
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي المستندات: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا توجد مستندات بعد."
        renderItem={(item) => {
          const version = item.versions[0];
          if (!version) {
            return `${item.title} — بدون إصدار`;
          }

          return `${item.title} — الإصدار ${version.version} — ${version.mimeType}`;
        }}
      />
    </PortalPage>
  );
}
