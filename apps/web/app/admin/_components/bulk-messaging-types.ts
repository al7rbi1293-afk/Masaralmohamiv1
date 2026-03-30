export type TrialPreviewRow = {
  orgId: string;
  orgName: string;
  email: string;
  fullName: string;
  role: string;
  endedAt: string;
  kind: 'first-time' | 'reminder';
};

export type TrialRecipientKind = 'all' | 'first-time' | 'reminder';

export type TrialStats = {
  expiredTrialRows: number;
  expiredOrgs: number;
  targetOrgs: number;
  recipients: number;
  firstTimeCount: number;
  reminderCount: number;
  selectedKind: TrialRecipientKind;
  selectedRecipients: number;
  skippedPaidOrgs: number;
};

export type TrialPreviewResponse = {
  stats: TrialStats;
  preview: TrialPreviewRow[];
};

export type TrialSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ orgId: string; email: string; error: string }>;
  updatedTrialsToExpired: number;
};

export type BatchInfo = {
  mode: 'send' | 'send_batch';
  batchIndex: number;
  batchSize: number;
  start: number;
  end: number;
  total: number;
  hasMore: boolean;
  nextBatchIndex: number | null;
};

export type TrialSendResponse = {
  stats: TrialStats;
  result: TrialSendResult;
  batch: BatchInfo;
};

export type AnnouncementSource = 'users' | 'offices' | 'users_and_offices';
export type AnnouncementAudience = AnnouncementSource;

export type AnnouncementPreviewRow = {
  email: string;
  fullName: string;
  orgName: string | null;
  source: AnnouncementSource;
};

export type AnnouncementStats = {
  audience: AnnouncementAudience;
  recipients: number;
  usersCount: number;
  officesCount: number;
};

export type AnnouncementPreviewResponse = {
  stats: AnnouncementStats;
  preview: AnnouncementPreviewRow[];
};

export type AnnouncementSendResult = {
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
};

export type AnnouncementSendResponse = {
  stats: AnnouncementStats;
  result: AnnouncementSendResult;
  batch: BatchInfo;
};

export const BATCH_SIZE = 80;
export const MAX_BATCH_REQUESTS = 200;

export const trialRecipientKindOptions: Array<{ value: TrialRecipientKind; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'first-time', label: 'أول إرسال' },
  { value: 'reminder', label: 'التذكير' },
];

export const audienceOptions: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: 'users_and_offices', label: 'جميع المستخدمين والمكاتب' },
  { value: 'users', label: 'جميع المستخدمين' },
  { value: 'offices', label: 'المكاتب (الحساب الرئيسي)' },
];
