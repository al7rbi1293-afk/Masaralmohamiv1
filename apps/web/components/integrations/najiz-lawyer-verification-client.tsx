'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type EligibleLawyer = {
  userId: string;
  fullName: string;
  email: string | null;
  role: 'owner' | 'lawyer';
  licenseNumber: string | null;
  isCurrentUser: boolean;
};

type VerificationStatus = 'pending' | 'verified' | 'not_found' | 'mismatch' | 'failed';

type VerificationRecord = {
  externalId: string;
  lawyerUserId: string | null;
  lawyerName: string | null;
  officeName: string | null;
  licenseNumber: string | null;
  nationalId: string | null;
  status: VerificationStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  syncedAt: string;
  source: string;
};

type NajizLawyerVerificationClientProps = {
  eligibleLawyers: EligibleLawyer[];
  initialVerifications: VerificationRecord[];
};

const statusMeta: Record<VerificationStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'قيد المراجعة', variant: 'warning' },
  verified: { label: 'موثّق', variant: 'success' },
  not_found: { label: 'غير موجود', variant: 'danger' },
  mismatch: { label: 'عدم تطابق', variant: 'danger' },
  failed: { label: 'فشل التحقق', variant: 'danger' },
};

export function NajizLawyerVerificationClient({
  eligibleLawyers,
  initialVerifications,
}: NajizLawyerVerificationClientProps) {
  const hasEligibleLawyers = eligibleLawyers.length > 0;
  const defaultLawyer = eligibleLawyers.find((member) => member.isCurrentUser) ?? eligibleLawyers[0] ?? null;
  const [selectedLawyerId, setSelectedLawyerId] = useState(defaultLawyer?.userId ?? '');
  const [licenseNumber, setLicenseNumber] = useState(defaultLawyer?.licenseNumber ?? '');
  const [nationalId, setNationalId] = useState('');
  const [endpointPath, setEndpointPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verifications, setVerifications] = useState(initialVerifications);

  const selectedLawyer = useMemo(
    () => eligibleLawyers.find((member) => member.userId === selectedLawyerId) ?? null,
    [eligibleLawyers, selectedLawyerId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLawyerId) {
      setError('لا يوجد محامٍ مؤهل متاح للتحقق داخل هذا المكتب.');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/verify-lawyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lawyer_user_id: selectedLawyerId,
          license_number: licenseNumber.trim() || undefined,
          national_id: nationalId.trim() || undefined,
          endpoint_path: endpointPath.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        verification?: {
          externalId?: string;
          lawyerUserId?: string | null;
          lawyerName?: string | null;
          officeName?: string | null;
          licenseNumber?: string | null;
          nationalId?: string | null;
          status?: VerificationStatus;
          verifiedAt?: string | null;
          expiresAt?: string | null;
          syncedAt?: string;
          source?: string;
        };
      };

      if (!response.ok || !payload.verification) {
        throw new Error(payload.error || 'تعذر تنفيذ التحقق من المحامي.');
      }

      const nextRecord: VerificationRecord = {
        externalId: payload.verification.externalId || crypto.randomUUID(),
        lawyerUserId: payload.verification.lawyerUserId ?? selectedLawyerId ?? null,
        lawyerName: payload.verification.lawyerName ?? selectedLawyer?.fullName ?? null,
        officeName: payload.verification.officeName ?? null,
        licenseNumber: payload.verification.licenseNumber ?? (licenseNumber.trim() || null),
        nationalId: payload.verification.nationalId ?? (nationalId.trim() || null),
        status: payload.verification.status ?? 'pending',
        verifiedAt: payload.verification.verifiedAt ?? null,
        expiresAt: payload.verification.expiresAt ?? null,
        syncedAt: payload.verification.syncedAt ?? new Date().toISOString(),
        source: payload.verification.source ?? 'najiz',
      };

      setVerifications((current) => {
        const deduped = current.filter((item) => item.externalId !== nextRecord.externalId);
        return [nextRecord, ...deduped];
      });
      setMessage(
        nextRecord.status === 'verified'
          ? 'تم التحقق من المحامي بنجاح.'
          : `تم إرسال طلب التحقق وحصلنا على الحالة: ${statusMeta[nextRecord.status].label}.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر تنفيذ التحقق من المحامي.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">التحقق من المحامي عبر Najiz</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            استخدم هذه الصفحة للتحقق من رخصة المحامي وربط نتيجة التحقق بسجل المكتب دون كشف أي أسرار تكامل.
          </p>
        </div>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {!hasEligibleLawyers ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            لا يوجد حاليًا عضو بدور مالك أو محامٍ داخل المكتب لربط التحقق به.
          </p>
        ) : null}

        <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">المحامي المستهدف</span>
            <select
              value={selectedLawyerId}
              onChange={(event) => {
                const nextId = event.target.value;
                const nextLawyer = eligibleLawyers.find((member) => member.userId === nextId) ?? null;
                setSelectedLawyerId(nextId);
                setLicenseNumber(nextLawyer?.licenseNumber ?? '');
              }}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              disabled={!hasEligibleLawyers}
              required
            >
              {eligibleLawyers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName || member.email || member.userId}
                  {member.isCurrentUser ? ' (أنا)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">رقم الرخصة</span>
            <input
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
              placeholder="مثال: 123456"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الهوية الوطنية</span>
            <input
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value)}
              placeholder="اختياري عند الحاجة"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">مسار endpoint مخصص</span>
            <input
              value={endpointPath}
              onChange={(event) => setEndpointPath(event.target.value)}
              placeholder="اختياري"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <Button type="submit" variant="primary" size="md" disabled={loading || !hasEligibleLawyers}>
              {loading ? 'جارٍ التحقق...' : 'التحقق الآن'}
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              إذا لم تُدخل رقم الرخصة، سيحاول النظام استخدام الرقم المحفوظ في ملف عضو المكتب.
            </span>
          </div>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-brand-navy dark:text-slate-100">آخر عمليات التحقق</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              سجلات مرجعية داخلية للمكتب مع حالة كل تحقق وآخر وقت مزامنة.
            </p>
          </div>
          <Badge variant="default">{verifications.length} سجل</Badge>
        </div>

        {!verifications.length ? (
          <div className="rounded-xl border border-dashed border-brand-border px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            لا توجد عمليات تحقق محفوظة بعد.
          </div>
        ) : (
          <div className="space-y-3">
            {verifications.map((record) => {
              const meta = statusMeta[record.status] ?? statusMeta.failed;
              return (
                <article
                  key={`${record.externalId}-${record.syncedAt}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {record.lawyerName || record.licenseNumber || 'تحقق بدون اسم'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {record.officeName || 'بدون اسم مكتب'}
                      </div>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>

                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">رقم الرخصة</dt>
                      <dd className="mt-1 text-slate-800 dark:text-slate-200">{record.licenseNumber || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">رقم الهوية</dt>
                      <dd className="mt-1 text-slate-800 dark:text-slate-200">{record.nationalId || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">آخر مزامنة</dt>
                      <dd className="mt-1 text-slate-800 dark:text-slate-200">{formatDate(record.syncedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">تاريخ التوثيق</dt>
                      <dd className="mt-1 text-slate-800 dark:text-slate-200">{formatDate(record.verifiedAt)}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return value;
  }
}
