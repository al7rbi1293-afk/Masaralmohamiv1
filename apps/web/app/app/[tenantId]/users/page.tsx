'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';
import { SimpleList } from '@/components/portal/simple-list';

type UsersResponse = {
  data: Array<{
    id: string;
    name: string;
    email: string;
    role: 'PARTNER' | 'LAWYER' | 'ASSISTANT';
    isActive: boolean;
  }>;
  total: number;
};

type UsersPageProps = {
  params: {
    tenantId: string;
  };
};

export default function UsersPage({ params }: UsersPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [payload, setPayload] = useState<UsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<UsersResponse>(session, '/users?page=1&pageSize=20')
      .then(setPayload)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل المستخدمين');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="المستخدمون" description="إدارة الفريق والأدوار (Partner فقط).">
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </p>
      ) : null}

      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">إجمالي المستخدمين: {payload?.total ?? 0}</p>

      <SimpleList
        items={payload?.data ?? []}
        emptyText="لا يوجد مستخدمون للعرض أو لا تملك صلاحية Partner."
        renderItem={(item) => `${item.name} — ${item.email} — ${item.role} — ${item.isActive ? 'نشط' : 'موقوف'}`}
      />
    </PortalPage>
  );
}
