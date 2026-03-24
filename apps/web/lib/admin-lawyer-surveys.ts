// Removed 'server-only' to allow sharing types/logic with client components

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const LAWYER_SURVEY_TOPIC = 'lawyer_survey_v1';

const SURVEY_ANSWER_LABELS = [
  'الصفة',
  'حجم المكتب',
  'سبب التسجيل',
  'حالة الاستخدام',
  'الأقسام المستخدمة',
  'أكبر فائدة',
  'سهولة الاستخدام',
  'العائق الرئيسي',
  'أهم 3 ميزات',
  'أهمية ناجز',
  'ملاءمة الباقات',
  'التوصية',
  'التواصل',
  'سبب عدم البدء/التوقف',
  'ما يسهل البدء',
  'الميزة المتوقعة',
  'أولوية التطوير',
  'اقتراح لتحسين البداية',
] as const;

export const LAWYER_SURVEY_EXPORT_COLUMNS = [
  { key: 'submitted_at', label: 'تاريخ الرد' },
  { key: 'full_name', label: 'الاسم' },
  { key: 'email', label: 'البريد' },
  { key: 'phone', label: 'الجوال' },
  { key: 'firm_name', label: 'المكتب' },
  { key: 'role', label: 'الصفة' },
  { key: 'office_size', label: 'حجم المكتب' },
  { key: 'main_reason', label: 'سبب التسجيل' },
  { key: 'usage_status', label: 'حالة الاستخدام' },
  { key: 'used_modules', label: 'الأقسام المستخدمة' },
  { key: 'top_benefit', label: 'أكبر فائدة' },
  { key: 'ease_rating', label: 'سهولة الاستخدام' },
  { key: 'active_blocker', label: 'العائق الرئيسي' },
  { key: 'feature_priorities', label: 'أهم 3 ميزات' },
  { key: 'najiz_importance', label: 'أهمية ناجز' },
  { key: 'pricing_fit', label: 'ملاءمة الباقات' },
  { key: 'recommendation', label: 'التوصية' },
  { key: 'follow_up_interest', label: 'التواصل' },
  { key: 'inactive_reason', label: 'سبب عدم البدء/التوقف' },
  { key: 'activation_support', label: 'ما يسهل البدء' },
  { key: 'missing_feature', label: 'الميزة المتوقعة' },
  { key: 'future_improvement', label: 'أولوية التطوير' },
  { key: 'onboarding_improvement', label: 'اقتراح لتحسين البداية' },
  { key: 'referrer', label: 'الرابط المرجعي' },
  { key: 'raw_message', label: 'الرسالة الخام' },
] as const;

type LawyerSurveyLeadRow = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  firm_name: string | null;
  topic: string | null;
  message: string | null;
  referrer: string | null;
};

export type LawyerSurveyResponse = {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string | null;
  firmName: string | null;
  topic: string | null;
  referrer: string | null;
  rawMessage: string;
  answers: Record<string, string>;
};

export async function getLawyerSurveyResponses() {
  const adminClient = createSupabaseServerClient();
  const { data, error } = await adminClient
    .from('leads')
    .select('id, created_at, full_name, email, phone, firm_name, topic, message, referrer')
    .eq('topic', LAWYER_SURVEY_TOPIC)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as LawyerSurveyLeadRow[] | null) ?? []).map(mapLeadToSurveyResponse);
}

export function getLawyerSurveyAnswerPairs(response: LawyerSurveyResponse) {
  return SURVEY_ANSWER_LABELS.map((label) => ({
    label,
    value: response.answers[label] ?? '—',
  }));
}

export function buildLawyerSurveyExportRows(responses: LawyerSurveyResponse[]) {
  return responses.map((response) => ({
    'تاريخ الرد': formatExportDate(response.createdAt),
    'الاسم': response.fullName,
    'البريد': response.email,
    'الجوال': response.phone ?? '',
    'المكتب': response.firmName ?? '',
    'الصفة': response.answers['الصفة'] ?? '',
    'حجم المكتب': response.answers['حجم المكتب'] ?? '',
    'سبب التسجيل': response.answers['سبب التسجيل'] ?? '',
    'حالة الاستخدام': response.answers['حالة الاستخدام'] ?? '',
    'الأقسام المستخدمة': response.answers['الأقسام المستخدمة'] ?? '',
    'أكبر فائدة': response.answers['أكبر فائدة'] ?? '',
    'سهولة الاستخدام': response.answers['سهولة الاستخدام'] ?? '',
    'العائق الرئيسي': response.answers['العائق الرئيسي'] ?? '',
    'أهم 3 ميزات': response.answers['أهم 3 ميزات'] ?? '',
    'أهمية ناجز': response.answers['أهمية ناجز'] ?? '',
    'ملاءمة الباقات': response.answers['ملاءمة الباقات'] ?? '',
    'التوصية': response.answers['التوصية'] ?? '',
    'التواصل': response.answers['التواصل'] ?? '',
    'سبب عدم البدء/التوقف': response.answers['سبب عدم البدء/التوقف'] ?? '',
    'ما يسهل البدء': response.answers['ما يسهل البدء'] ?? '',
    'الميزة المتوقعة': response.answers['الميزة المتوقعة'] ?? '',
    'أولوية التطوير': response.answers['أولوية التطوير'] ?? '',
    'اقتراح لتحسين البداية': response.answers['اقتراح لتحسين البداية'] ?? '',
    'الرابط المرجعي': response.referrer ?? '',
    'الرسالة الخام': response.rawMessage,
  }));
}

export function summarizeLawyerSurveyResponses(responses: LawyerSurveyResponse[]) {
  const activeUsageCount = responses.filter((response) => {
    const value = response.answers['حالة الاستخدام'] ?? '';
    return value === 'أستخدمها بشكل مستمر' || value === 'استخدمتها بشكل محدود';
  }).length;

  const inactiveUsageCount = responses.filter((response) => {
    const value = response.answers['حالة الاستخدام'] ?? '';
    return value === 'سجلت ولم أبدأ بعد' || value === 'توقفت عن استخدامها';
  }).length;

  const followUpCount = responses.filter((response) => {
    const value = response.answers['التواصل'] ?? '';
    return value.startsWith('نعم');
  }).length;

  return {
    total: responses.length,
    activeUsageCount,
    inactiveUsageCount,
    followUpCount,
  };
}

function mapLeadToSurveyResponse(row: LawyerSurveyLeadRow): LawyerSurveyResponse {
  return {
    id: row.id,
    createdAt: row.created_at,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    firmName: row.firm_name,
    topic: row.topic,
    referrer: row.referrer,
    rawMessage: row.message ?? '',
    answers: parseSurveyAnswers(row.message),
  };
}

function parseSurveyAnswers(message: string | null) {
  const answers: Record<string, string> = {};
  const lines = String(message ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const label = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!label) {
      continue;
    }

    answers[label] = value || '—';
  }

  return answers;
}

function formatExportDate(value: string) {
  return new Date(value).toISOString();
}
