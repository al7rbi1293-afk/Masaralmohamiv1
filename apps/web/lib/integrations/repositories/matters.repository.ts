import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MatterReference, NormalizedExternalCaseEvent } from '../domain/models';

type MatterRow = {
  id: string;
  org_id: string;
  client_id: string | null;
  title: string;
  najiz_case_number: string | null;
  assigned_user_id: string | null;
  is_private: boolean;
};

export async function getMatterReference(orgId: string, matterId: string): Promise<MatterReference | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('matters')
    .select('id, org_id, client_id, title, najiz_case_number, assigned_user_id, is_private')
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as MatterRow | null;
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    clientId: row.client_id,
    najizCaseNumber: row.najiz_case_number,
    assignedUserId: row.assigned_user_id,
    isPrivate: row.is_private,
  };
}

export async function updateMatterNajizCaseNumber(orgId: string, matterId: string, caseNumber: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('matters')
    .update({ najiz_case_number: caseNumber })
    .eq('org_id', orgId)
    .eq('id', matterId);

  if (error) {
    throw error;
  }
}

export async function appendMatterTimelineEvents(input: {
  orgId: string;
  matterId: string;
  createdBy: string;
  events: NormalizedExternalCaseEvent[];
}) {
  if (!input.events.length) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const rows = input.events.map((event) => ({
    org_id: input.orgId,
    matter_id: input.matterId,
    type: event.eventType === 'session' ? 'hearing' : 'other',
    note: buildMatterNote(event),
    event_date: event.occurredAt,
    created_by: input.createdBy,
  }));

  const { error } = await supabase.from('matter_events').insert(rows);
  if (error) {
    throw error;
  }
}

function buildMatterNote(event: NormalizedExternalCaseEvent) {
  const title = event.title.trim();
  const description = event.description?.trim();
  return description ? `[Najiz] ${title}: ${description}` : `[Najiz] ${title}`;
}
