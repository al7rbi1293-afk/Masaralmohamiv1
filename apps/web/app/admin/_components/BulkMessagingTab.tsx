'use client';

import { useMemo, useState } from 'react';
import { callBulkEmailApi } from './bulk-messaging-helpers';
import {
  BATCH_SIZE,
  MAX_BATCH_REQUESTS,
  type AnnouncementAudience,
  type AnnouncementPreviewResponse,
  type AnnouncementSendResponse,
  type AnnouncementSendResult,
  type AnnouncementStats,
  type BatchInfo,
  type TrialPreviewResponse,
  type TrialSendResponse,
  type TrialSendResult,
  type TrialStats,
} from './bulk-messaging-types';
import {
  AnnouncementCampaignSection,
  BulkMessagingHero,
  TrialCampaignSection,
} from './bulk-messaging-sections';

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

        setTrialBatchProgress(`تمت دفعة ${data.batch.batchIndex + 1} (${data.batch.end}/${data.batch.total})`);

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

        setAnnouncementBatchProgress(`تمت دفعة ${data.batch.batchIndex + 1} (${data.batch.end}/${data.batch.total})`);

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
      <BulkMessagingHero />

      <TrialCampaignSection
        trialLoading={trialLoading}
        trialError={trialError}
        trialBatchProgress={trialBatchProgress}
        trialPreview={trialPreview}
        trialResult={trialResult}
        onPreview={() => {
          void handleTrialPreview();
        }}
        onSend={() => {
          void handleTrialSend();
        }}
        onBatchSend={() => {
          void handleTrialBatchSend();
        }}
      />

      <AnnouncementCampaignSection
        audience={audience}
        subject={subject}
        message={message}
        canSendAnnouncement={canSendAnnouncement}
        announcementLoading={announcementLoading}
        announcementError={announcementError}
        announcementBatchProgress={announcementBatchProgress}
        announcementPreview={announcementPreview}
        announcementResult={announcementResult}
        onAudienceChange={setAudience}
        onSubjectChange={setSubject}
        onMessageChange={setMessage}
        onPreview={() => {
          void handleAnnouncementPreview();
        }}
        onSend={() => {
          void handleAnnouncementSend();
        }}
        onBatchSend={() => {
          void handleAnnouncementBatchSend();
        }}
      />
    </div>
  );
}
