import { AlertTriangle, BellRing, Building2, Megaphone, RefreshCcw, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, sourceLabel } from './bulk-messaging-helpers';
import { audienceOptions, type AnnouncementAudience, type AnnouncementPreviewResponse, type AnnouncementSendResponse, type TrialPreviewResponse, type TrialSendResponse } from './bulk-messaging-types';
import { StatCard } from './bulk-messaging-ui';

export function BulkMessagingHero() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">الارسال الجماعي</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        أداة إدارة للإرسال الجماعي: متابعة المشتركين المنتهية تجربتهم، وحملات الرسائل الإعلانية لجميع المستخدمين أو المكاتب.
      </p>
    </div>
  );
}

type TrialCampaignSectionProps = {
  trialLoading: 'preview' | 'send' | 'batch' | null;
  trialError: string | null;
  trialBatchProgress: string | null;
  trialPreview: TrialPreviewResponse | null;
  trialResult: TrialSendResponse | null;
  onPreview: () => void;
  onSend: () => void;
  onBatchSend: () => void;
};

export function TrialCampaignSection({
  trialLoading,
  trialError,
  trialBatchProgress,
  trialPreview,
  trialResult,
  onPreview,
  onSend,
  onBatchSend,
}: TrialCampaignSectionProps) {
  return (
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
          <Button type="button" variant="outline" onClick={onPreview} disabled={trialLoading !== null} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            {trialLoading === 'preview' ? 'جارٍ المعاينة...' : 'تحديث المعاينة'}
          </Button>
          <Button type="button" onClick={onSend} disabled={trialLoading !== null} className="gap-2">
            <Send className="h-4 w-4" />
            {trialLoading === 'send' ? 'جارٍ الإرسال...' : 'إرسال الآن'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onBatchSend}
            disabled={trialLoading !== null}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {trialLoading === 'batch' ? 'جارٍ الإرسال على دفعات...' : 'إرسال على دفعات'}
          </Button>
        </div>
      </div>

      {trialError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          {trialError}
        </div>
      ) : null}

      {trialBatchProgress ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {trialBatchProgress}
        </div>
      ) : null}

      {trialPreview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="المستلمين" value={trialPreview.stats.recipients} />
          <StatCard label="أول إرسال" value={trialPreview.stats.firstTimeCount} />
          <StatCard label="تذكير" value={trialPreview.stats.reminderCount} />
          <StatCard label="تم استبعادهم (مدفوع)" value={trialPreview.stats.skippedPaidOrgs} />
        </div>
      ) : null}

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

      {trialResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
          تم الإرسال: {trialResult.result.sent} من {trialResult.result.attempted}، وفشل: {trialResult.result.failed}، وتم تحديث حالة{' '}
          {trialResult.result.updatedTrialsToExpired} تجربة إلى منتهية.
        </div>
      ) : null}
    </section>
  );
}

type AnnouncementCampaignSectionProps = {
  audience: AnnouncementAudience;
  subject: string;
  message: string;
  canSendAnnouncement: boolean;
  announcementLoading: 'preview' | 'send' | 'batch' | null;
  announcementError: string | null;
  announcementBatchProgress: string | null;
  announcementPreview: AnnouncementPreviewResponse | null;
  announcementResult: AnnouncementSendResponse | null;
  onAudienceChange: (value: AnnouncementAudience) => void;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onPreview: () => void;
  onSend: () => void;
  onBatchSend: () => void;
};

export function AnnouncementCampaignSection({
  audience,
  subject,
  message,
  canSendAnnouncement,
  announcementLoading,
  announcementError,
  announcementBatchProgress,
  announcementPreview,
  announcementResult,
  onAudienceChange,
  onSubjectChange,
  onMessageChange,
  onPreview,
  onSend,
  onBatchSend,
}: AnnouncementCampaignSectionProps) {
  return (
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
            onChange={(event) => onAudienceChange(event.target.value as AnnouncementAudience)}
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
            onChange={(event) => onSubjectChange(event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-brand-emerald transition focus:border-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="اكتب عنوان الرسالة"
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">محتوى الرسالة</span>
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
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
          onClick={onPreview}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          {announcementLoading === 'preview' ? 'جارٍ المعاينة...' : 'معاينة المستلمين'}
        </Button>
        <Button
          type="button"
          disabled={announcementLoading !== null || !canSendAnnouncement}
          onClick={onSend}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {announcementLoading === 'send' ? 'جارٍ الإرسال...' : 'إرسال الرسالة الجماعية'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={announcementLoading !== null || !canSendAnnouncement}
          onClick={onBatchSend}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {announcementLoading === 'batch' ? 'جارٍ الإرسال على دفعات...' : 'إرسال على دفعات'}
        </Button>
      </div>

      {!canSendAnnouncement ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          يجب كتابة عنوان (3 أحرف على الأقل) ونص رسالة (5 أحرف على الأقل).
        </div>
      ) : null}

      {announcementError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          {announcementError}
        </div>
      ) : null}

      {announcementBatchProgress ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {announcementBatchProgress}
        </div>
      ) : null}

      {announcementPreview ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="إجمالي المستلمين" value={announcementPreview.stats.recipients} />
          <StatCard label="من المستخدمين" value={announcementPreview.stats.usersCount} />
          <StatCard label="من المكاتب" value={announcementPreview.stats.officesCount} />
        </div>
      ) : null}

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

      {announcementResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
          تم الإرسال: {announcementResult.result.sent} من {announcementResult.result.attempted}، وفشل: {announcementResult.result.failed}.
        </div>
      ) : null}
    </section>
  );
}
