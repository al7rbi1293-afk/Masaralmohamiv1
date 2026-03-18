'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type NajizCaseDetailsClientProps = {
  matterId: string;
  caseNumber?: string | null;
  initialSyncStatus?: 'syncing' | 'idle';
};

export function NajizCaseDetailsClient({ matterId, caseNumber, initialSyncStatus = 'idle' }: NajizCaseDetailsClientProps) {
  const [syncing, setSyncing] = useState(initialSyncStatus === 'syncing');
  const [caseDetails, setCaseDetails] = useState<any>(null);
  const [hearings, setHearings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!caseNumber) {
      setError('يرجى إضافة رقم القضية في ناجز أولاً من خلال تعديل القضية المقيدة.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      // 1. Sync Case
      const caseRes = await fetch(`/api/najiz/sync-case/${matterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseNumber })
      });
      const caseData = await caseRes.json();
      
      if (!caseRes.ok) throw new Error(caseData.error || 'فشل مزامنة بيانات القضية');
      setCaseDetails(caseData);

      // 2. Sync Hearings
      const hearRes = await fetch(`/api/najiz/sync-hearings/${matterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseNumber })
      });
      const hearData = await hearRes.json();
      
      if (!hearRes.ok) throw new Error(hearData.error || 'فشل مزامنة الجلسات');
      
      setHearings(new Array(hearData.count).fill({ status: 'مجدولة' }));
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 mt-4 border border-brand-emerald bg-brand-emerald/5 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm rounded-lg col-span-full transition-all hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-brand-navy dark:text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            تكامل المنصة الوطنية - ناجز
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            مزامنة تفاصيل القضية والجلسات الفورية من خلال الربط الحكومي
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !caseNumber} variant="primary" className="gap-2 shrink-0 bg-brand-emerald hover:bg-brand-emerald/90 text-white">
          {syncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              جاري الاتصال و المزامنة...
            </>
          ) : (
            'تحديث ومزامنة الآن'
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200">{error}</p>
      ) : null}

      {caseDetails ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-3 border-t border-brand-emerald/30 pt-4">
          <div className="bg-white dark:bg-slate-900 rounded-md p-3 shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">مقر المحكمة</p>
            <p className="font-medium text-sm mt-1">{caseDetails.courtName}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-md p-3 shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">الدائرة القضائية</p>
            <p className="font-medium text-sm mt-1">{caseDetails.courtCircuit}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-md p-3 shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">الحالة في المنصة</p>
            <Badge variant="default" className="mt-1 bg-brand-navy">{caseDetails.status}</Badge>
          </div>
        </div>
      ) : null}

      {hearings.length > 0 ? (
        <div className="mt-4 border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">الجلسات المجدولة (تم مزامنتها)</p>
          <div className="space-y-3">
            {hearings.map((h, i) => (
              <div key={i} className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div className="flex gap-2 items-center">
                   <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                   <span className="font-medium">الجلسة {i + 1}</span>
                   <Badge variant="default" className="text-xs ml-2">{h.status}</Badge>
                </div>
                <Badge variant="default" className="cursor-pointer hover:bg-brand-emerald hover:text-white transition-colors">دخول الجلسة الافتراضية</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
