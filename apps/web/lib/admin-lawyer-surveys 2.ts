import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  LAWYER_SURVEY_TOPIC,
  type LawyerSurveyResponse,
} from './survey-utils';

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
