'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Megaphone, Send, UserRound, Building2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TrialPreviewRow = {
  orgId: string;
  orgName: string;
  email: string;
  fullName: string;
  role: string;
  endedAt: string;
  kind: 'first-time' | 'reminder';
};

type TrialStats = {
  expiredTrialRows: number;
  expiredOrgs: number;
  targetOrgs: number;
  recipients: number;
  firstTimeCount: number;
  reminderCount: number;
  skippedPaidOrgs: number;
};

type TrialPreviewResponse = {
  stats: TrialStats;
  preview: TrialPreviewRow[];
};

type TrialSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ orgId: string; email: string; error: string }>;
  updatedTrialsToExpired: number;
};

type BatchInfo = {
  mode: 'send' | 'send_batch';
  batchIndex: number;
  batchSize: number;
  start: number;
  end: number;
  total: number;
  hasMore: boolean;
  nextBatchIndex: number | null;
};

type TrialSendResponse = {
  stats: TrialStats;
  result: TrialSendResult;
  batch: BatchInfo;
};

type AnnouncementSource = 'users' | 'offices' | 'users_and_offices';
type AnnouncementAudience = AnnouncementSource;

type AnnouncementPreviewRow = {
  email: string;
  fullName: string;
  orgName: string | null;
  source: AnnouncementSource;
};

type AnnouncementStats = {
  audience: AnnouncementAudience;
  recipients: number;
  usersCount: number;
  officesCount: number;
};

type AnnouncementPreviewResponse = {
  stats: AnnouncementStats;
  preview: AnnouncementPreviewRow[];
};

type AnnouncementSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
};

type AnnouncementSendResponse = {
  stats: AnnouncementStats;
  result: AnnouncementSendResult;
  batch: BatchInfo;
};

const BATCH_SIZE = 80;
const MAX_BATCH_REQUESTS = 200;

const audienceOptions: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: 'users_and_offices', label: 'جميع المستخدمين والمكاتب' },
  { value: 'users', label: 'جميع المستخدمين' },
  { value: 'offices', label: 'المكاتب (الحساب الرئيسي)' },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-SA');
}

function sourceLabel(source: AnnouncementSource) {
  if (source === 'users') return 'مستخدم';
  if (source === 'offices') return 'مكتب';
  return 'مستخدم + مكتب';
}

async function callBulkEmailApi<T>(payload: Record<string, unknown>) {
  const response = await fetch('/admin/api/bulk-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error || 'تعذر تنفيذ العملية.';
    throw new Error(message);
  }

  return data as T;
}

export default function BulkMessagingTab() {
  const [trialPreview, setTrialPreview] = useState<TrialPreviewResponse | null>(null);
  const [trialResult, setTrialResult] = useState<TrialSendResponse | null>(null);
  const [trialLoading, setTrialLoading] = useState<'preview' | 'send' | 'batch' | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialBatchProgress, setTrialBatchProgress] = useState<string | null>(null);

  const [audience, setAudience] = useState<AnnouncementAudience>('users_and_offices');
  const [subject, setSubject] = useState('تحديث من منصة مسار المحامي');
  const [message, setMessage] = useState('');
  const [announcementPreview, setAnnouncementPreview] = useState<AnnouncementPreviewResponse | null>(null);
  const [announcementResult, setAnnouncementResult] = useState<AnnouncementSendResponse | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState<'preview' | 'send' | 'batch' | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementBatchProgress, setAnnouncementBatchProgress] = useState<string | null>(null);

  const canSendAnnouncement = useMemo(() => subject.trim().length >= 3 && message.trim().length >= 5, [subject, message]);

  async function handleTrialPreview() {
    setTrialError(null);
    setTrialResult(null);
    setTrialBatchProgress(null);
    setTrialLoading('preview');
    try {
      const data = await callBulkEmailApi<TrialPreviewResponse>({
        campaign: 'trial_expired',
        mode: 'preview',
      });
      setTrialPreview(data);
    } catch (error) {
      setTrialError(error instanceof Error ? error.message : 'تعذر تحميل المعاينة.');
    } finally {
      setTrialLoading(null);
    }
  }

  async function handleTrialSend() {
    setTrialError(null);
    setTrialBatchProgress(null);
    setTrialLoading('send');
    setTrialResult(null);

    try {
      const proceed = window.confirm('سيتم إرسال رسائل انتهاء التجربة الآن. هل تريد المتابعة؟');
      if (!proceed) {
        return;
      }

      const data = await callBulkEmailApi<TrialSendResponse>({
        campaign: 'trial_expired',
        mode: 'send',
      });
      setTrialResult(data);
      setTrialPreview({ stats: data.stats, preview: trialPreview?.preview ?? [] });
    } catch (error) {
      setTrialError(error instanceof Error ? error.message : 'تعذر تنفيذ الإرسال.');
    } finally {
      setTrialLoading(null);
    }
  }

  async function handleTrialBatchSend() {
    setTrialError(null);
    setTrialResult(null);
    setTrialLoading('batch');
    setTrialBatchProgress('بدء الإرسال على دفعات...');

    try {
      const proceed = window.confirm(`سيتم الإرسال على دفعات (${BATCH_SIZE} مستلم لكل دفعة). هل تريد المتابعة؟`);
      if (!proceed) {
        return;
      }

      let batchIndex = 0;
      let attempts = 0;
      let aggregate: TrialSendResult = {
        attempted: 0,
        sent: 0,
        failed: 0,
        failures: [],
        updatedTrialsToExpired: 0,
      };
      let latestStats: TrialStats | null = null;
      let lastBatch: BatchInfo | null = null;

      while (attempts < MAX_BATCH_REQUESTS) {
        attempts += 1;
        const data = await callBulkEmailApi<TrialSendResponse>({
          campaign: 'trial_expired',
          mode: 'send_batch',
          batch_index: batchIndex,
          batch_size: BATCH_SIZE,
        });

        latestStats = data.stats;
        lastBatch = data.batch;
        aggregate = {
          attempted: aggregate.attempted + data.result.attempted,
          sent: aggregate.sent + data.result.sent,
          failed: aggregate.failed + data.result.failed,
          failures: [...aggregate.failures, ...data.result.failures].slice(0, 25),
          updatedTrialsToExpired: aggregate.updatedTrialsToExpired + data.result.updatedTrialsToExpired,
        };

        setTrialBatchProgress(
          `تمت دفعة ${data.batch.batchIndex + 1} (${data.batch.end}/${data.batch.total})`,
        );

        if (!data.batch.hasMore || data.batch.nextBatchIndex === null) {
          break;
        }
        batchIndex = data.batch.nextBatchIndex;
      }

      if (!latestStats || !lastBatch) {
        throw new Error('تعذر إكمال الإرسال على دفعات.');
      }

      setTrialResult({
        stats: latestStats,
        result: aggregate,
        batch: lastBatch,
      });
      setTrialPreview({ stats: latestStats, preview: trialPreview?.preview ?? [] });
      setTrialBatchProgress('اكتمل الإرسال على دفعات.');
    } catch (error) {
      setTrialError(error instanceof Error ? error.message : 'تعذر تنفيذ الإرسال على دفعات.');
    } finally {
      setTrialLoading(null);
    }
  }

  async function handleAnnouncementPreview() {
    setAnnouncementError(null);
    setAnnouncementResult(null);
    setAnnouncementBatchProgress(null);
    setAnnouncementLoading('preview');
    try {
      const data = await callBulkEmailApi<AnnouncementPreviewResponse>({
        campaign: 'announcement',
        mode: 'preview',
        audience,
        subject,
        message,
      });
      setAnnouncementPreview(data);
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : 'تعذر تحميل المعاينة.');
    } finally {
      setAnnouncementLoading(null);
    }
  }

  async function handleAnnouncementSend() {
    setAnnouncementError(null);
    setAnnouncementResult(null);
    setAnnouncementBatchProgress(null);
    setAnnouncementLoading('send');
    try {
      const proceed = window.confirm('سيتم إرسال الرسالة الجماعية الآن. هل تريد المتابعة؟');
      if (!proceed) {
        return;
      }

      const data = await callBulkEmailApi<AnnouncementSendResponse>({
        campaign: 'announcement',
        mode: 'send',
        audience,
        subject,
        message,
      });
      setAnnouncementResult(data);
      setAnnouncementPreview({
        stats: data.stats,
        preview: announcementPreview?.preview ?? [],
      });
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : 'تعذر تنفيذ الإرسال.');
    } finally {
      setAnnouncementLoading(null);
    }
  }

  async function handleAnnouncementBatchSend() {
    setAnnouncementError(null);
    setAnnouncementResult(null);
    setAnnouncementLoading('batch');
    setAnnouncementBatchProgress('بدء الإرسال على دفعات...');

    try {
      const proceed = window.confirm(`سيتم إرسال الإعلان على دفعات (${BATCH_SIZE} مستلم لكل دفعة). هل تريد المتابعة؟`);
      if (!proceed) {
        return;
      }

      let batchIndex = 0;
      let attempts = 0;
      let aggregate: AnnouncementSendResult = {
        attempted: 0,
        sent: 0,
        failed: 0,
        failures: [],
      };
      let latestStats: AnnouncementStats | null = null;
      let lastBatch: BatchInfo | null = null;

      while (attempts < MAX_BATCH_REQUESTS) {
        attempts += 1;
        const data = await callBulkEmailApi<AnnouncementSendResponse>({
          campaign: 'announcement',
          mode: 'send_batch',
          audience,
          subject,
          message,
          batch_index: batchIndex,
          batch_size: BATCH_SIZE,
        });

        latestStats = data.stats;
        lastBatch = data.batch;
        aggregate = {
          attempted: aggregate.attempted + data.result.attempted,
          sent: aggregate.sent + data.result.sent,
          failed: aggregate.failed + data.result.failed,
          failures: [...aggregate.failures, ...data.result.failures].slice(0, 25),
        };

        setAnnouncementBatchProgress(
          `تمت دفعة ${data.batch.batchIndex + 1} (${data.batch.end}/${data.batch.total})`,
        );

        if (!data.batch.hasMore || data.batch.nextBatchIndex === null) {
          break;
        }
        batchIndex = data.batch.nextBatchIndex;
      }

      if (!latestStats || !lastBatch) {
        throw new Error('تعذر إكمال الإرسال على دفعات.');
      }

      setAnnouncementResult({
        stats: latestStats,
        result: aggregate,
        batch: lastBatch,
      });
      setAnnouncementPreview({
        stats: latestStats,
        preview: announcementPreview?.preview ?? [],
      });
      setAnnouncementBatchProgress('اكتمل الإرسال على دفعات.');
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : 'تعذر تنفيذ الإرسال على دفعات.');
    } finally {
      setAnnouncementLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">الارسال الجماعي</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          أداة إدارة للإرسال الجماعي: متابعة المشتركين المنتهية تجربتهم، وحملات الرسائل الإعلانية لجميع المستخدمين أو المكاتب.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-navy dark:text-slate-100">
              <BellRing className="h-5 w-5 text-brand-emerald" />
              رسائل انتهاء التجربة
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ترسل لجميع من انتهت تجربتهم، والمرسل لهم سابقًا يصلهم كتذكير تلقائي.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTrialPreview}
              disabled={trialLoading !== null}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {trialLoading === 'preview' ? 'جارٍ المعاينة...' : 'تحديث المعاينة'}
            </Button>
            <Button type="button" onClick={handleTrialSend} disabled={trialLoading !== null} className="gap-2">
              <Send className="h-4 w-4" />
              {trialLoading === 'send' ? 'جارٍ الإرسال...' : 'إرسال الآن'}
            </Button>
            <Button type="button" variant="secondary" onClick={handleTrialBatchSend} disabled={trialLoading !== null} className="gap-2">
              <Send className="h-4 w-4" />
              {trialLoading === 'batch' ? 'جارٍ الإرسال على دفعات...' : 'إرسال على دفعات'}
            </Button>
          </div>
        </div>

        {trialError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
            {trialError}
          </div>
        )}
        {trialBatchProgress && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {trialBatchProgress}
          </div>
        )}

        {trialPreview && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="المستلمين" value={trialPreview.stats.recipients} />
            <StatCard label="أول إرسال" value={trialPreview.stats.firstTimeCount} />
            <StatCard label="تذكير" value={trialPreview.stats.reminderCount} />
            <StatCard label="تم استبعادهم (مدفوع)" value={trialPreview.stats.skippedPaidOrgs} />
          </div>
        )}

        {trialPreview?.preview?.length ? (
          <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">المكتب</th>
                  <th className="px-3 py-2 text-start font-medium">المستلم</th>
                  <th className="px-3 py-2 text-start font-medium">البريد</th>
                  <th className="px-3 py-2 text-start font-medium">النوع</th>
                  <th className="px-3 py-2 text-start font-medium">انتهت في</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trialPreview.preview.map((item) => (
                  <tr key={`${item.orgId}-${item.email}`}>
                    <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{item.orgName}</td>
                    <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{item.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{item.email}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.kind === 'reminder'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}
                      >
                        {item.kind === 'reminder' ? 'تذكير' : 'أول إرسال'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{formatDate(item.endedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {trialResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
            تم الإرسال: {trialResult.result.sent} من {trialResult.result.attempted}، وفشل: {trialResult.result.failed}، وتم تحديث حالة{' '}
            {trialResult.result.updatedTrialsToExpired} تجربة إلى منتهية.
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-navy dark:text-slate-100">
            <Megaphone className="h-5 w-5 text-brand-emerald" />
            رسالة جماعية إعلانية
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أرسل إعلانًا موحدًا لجميع المستخدمين أو المكاتب. يمكنك استخدام المتغيرات:
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">{'{{name}}'}</code>
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">{'{{office_name}}'}</code>
            <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">{'{{email}}'}</code>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الفئة المستهدفة</span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand-emerald transition focus:border-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {audienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">عنوان الرسالة</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand-emerald transition focus:border-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="اكتب عنوان الرسالة"
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">محتوى الرسالة</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-7 outline-none ring-brand-emerald transition focus:border-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="اكتب نص الرسالة الإعلانية هنا..."
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={announcementLoading !== null || !canSendAnnouncement}
            onClick={handleAnnouncementPreview}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            {announcementLoading === 'preview' ? 'جارٍ المعاينة...' : 'معاينة المستلمين'}
          </Button>
          <Button
            type="button"
            disabled={announcementLoading !== null || !canSendAnnouncement}
            onClick={handleAnnouncementSend}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {announcementLoading === 'send' ? 'جارٍ الإرسال...' : 'إرسال الرسالة الجماعية'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={announcementLoading !== null || !canSendAnnouncement}
            onClick={handleAnnouncementBatchSend}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {announcementLoading === 'batch' ? 'جارٍ الإرسال على دفعات...' : 'إرسال على دفعات'}
          </Button>
        </div>

        {!canSendAnnouncement && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            يجب كتابة عنوان (3 أحرف على الأقل) ونص رسالة (5 أحرف على الأقل).
          </div>
        )}

        {announcementError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
            {announcementError}
          </div>
        )}
        {announcementBatchProgress && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {announcementBatchProgress}
          </div>
        )}

        {announcementPreview && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="إجمالي المستلمين" value={announcementPreview.stats.recipients} />
            <StatCard label="من المستخدمين" value={announcementPreview.stats.usersCount} />
            <StatCard label="من المكاتب" value={announcementPreview.stats.officesCount} />
          </div>
        )}

        {announcementPreview?.preview?.length ? (
          <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">الاسم</th>
                  <th className="px-3 py-2 text-start font-medium">البريد</th>
                  <th className="px-3 py-2 text-start font-medium">المكتب</th>
                  <th className="px-3 py-2 text-start font-medium">المصدر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {announcementPreview.preview.map((item) => (
                  <tr key={item.email}>
                    <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{item.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{item.email}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{item.orgName ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {item.source === 'users' ? <UserRound className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {sourceLabel(item.source)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {announcementResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
            تم الإرسال: {announcementResult.result.sent} من {announcementResult.result.attempted}، وفشل:{' '}
            {announcementResult.result.failed}.
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-navy dark:text-slate-100">{value}</p>
    </article>
  );
}
