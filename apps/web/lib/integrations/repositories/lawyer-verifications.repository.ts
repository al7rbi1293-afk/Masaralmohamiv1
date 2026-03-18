import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { NormalizedLawyerVerification } from '../domain/models';

export async function upsertLawyerVerification(input: {
  orgId: string;
  lawyerUserId: string | null;
  requestedBy: string | null;
  syncJobId: string | null;
  verification: NormalizedLawyerVerification;
}) {
  const supabase = createSupabaseServerClient();
  const payload = {
    org_id: input.orgId,
    provider: input.verification.provider,
    source: input.verification.source,
    lawyer_user_id: input.lawyerUserId,
    sync_job_id: input.syncJobId,
    requested_by: input.requestedBy,
    external_id: input.verification.externalId,
    license_number: input.verification.licenseNumber,
    national_id: input.verification.nationalId,
    lawyer_name: input.verification.lawyerName,
    office_name: input.verification.officeName,
    status: input.verification.status,
    verified_at: input.verification.verifiedAt,
    expires_at: input.verification.expiresAt,
    payload_json: input.verification.payloadJson,
    synced_at: input.verification.syncedAt,
  };

  const { data, error } = await supabase
    .from('lawyer_verifications')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listRecentLawyerVerifications(orgId: string, limit = 20) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('lawyer_verifications')
    .select('*')
    .eq('org_id', orgId)
    .order('synced_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
