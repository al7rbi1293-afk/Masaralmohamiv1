'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type NajizClientPoAClientProps = {
  clientId: string;
  poaNumber?: string | null;
};

export function NajizClientPoAClient({ clientId, poaNumber }: NajizClientPoAClientProps) {
  const [syncing, setSyncing] = useState(false);
  const [poaStatus, setPoaStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!poaNumber) {
      setError('يرجى التأكد من حفظ رقم الوكالة في بيانات العميل لتتمكن من التحقق من صحتها في ناجز.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/najiz/validate-poa/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poaNumber })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'فشل التحقق من الوكالة');
      setPoaStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-brand-emerald bg-brand-emerald/5 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm rounded-lg transition-all hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-brand-navy dark:text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            التحقق من الوكالة عبر منصة ناجز
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            التحقق الفوري من سريان وموثوقية وكالة العميل ({poaNumber || 'غير محدد'})
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !poaNumber} variant="primary" className="gap-2 shrink-0 bg-brand-emerald hover:bg-brand-emerald/90 text-white">
          {syncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              جاري التحقق...
            </>
          ) : (
            'تحقق من الوكالة الآن'
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200">{error}</p>
      ) : null}

      {poaStatus ? (
        <div className="mt-5 border-t border-brand-emerald/30 pt-4">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 rounded-md p-3 shadow-sm border border-slate-100 dark:border-slate-800">
             <div>
                <p className="text-xs text-slate-500">حالة الوكالة في النظام الموحد</p>                
             </div>
             <div>
                {poaStatus.isRevoked ? (
                  <Badge variant="danger" className="animate-pulse">مفسوخة (غير صالحة)</Badge>
                ) : (
                  <Badge variant="success">سارية وموثوقة</Badge>
                )}
             </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
