'use client';

import { useEffect, useState } from 'react';
import { PortalPage } from '@/components/portal/portal-page';
import { useSessionGuard } from '@/components/portal/use-session-guard';
import { authedRequest } from '@/components/portal/use-authed-request';

type TenantSettings = {
  id: string;
  firmName: string;
  logoUrl: string | null;
  language: 'AR' | 'EN';
  hijriDisplay: boolean;
  retentionDays: number;
};

type SettingsPageProps = {
  params: {
    tenantId: string;
  };
};

export default function SettingsPage({ params }: SettingsPageProps) {
  const { session, loading } = useSessionGuard(params.tenantId);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    authedRequest<TenantSettings>(session, '/settings/tenant')
      .then(setSettings)
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'تعذّر تحميل الإعدادات');
      });
  }, [session]);

  if (loading || !session) {
    return null;
  }

  return (
    <PortalPage title="إعدادات المكتب" description="معلومات المكتب واللغة وإعدادات الاحتفاظ.">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {settings ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <dt className="text-slate-500 dark:text-slate-400">اسم المكتب</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{settings.firmName}</dd>
          </div>
          <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <dt className="text-slate-500 dark:text-slate-400">اللغة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{settings.language}</dd>
          </div>
          <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <dt className="text-slate-500 dark:text-slate-400">عرض الهجري</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {settings.hijriDisplay ? 'مفعل' : 'غير مفعل'}
            </dd>
          </div>
          <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <dt className="text-slate-500 dark:text-slate-400">مدة الاحتفاظ (يوم)</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{settings.retentionDays}</dd>
          </div>
        </dl>
      ) : null}
    </PortalPage>
  );
}
