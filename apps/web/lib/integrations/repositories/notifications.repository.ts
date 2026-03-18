import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { JsonObject } from '../domain/models';

export async function createIntegrationNotification(input: {
  orgId: string;
  recipientUserId?: string | null;
  category: 'integration_sync' | 'lawyer_verification' | 'case_sync' | 'judicial_cost' | 'enforcement_request';
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  payloadJson?: JsonObject;
}) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('notifications').insert({
    org_id: input.orgId,
    recipient_user_id: input.recipientUserId ?? null,
    source: 'najiz',
    category: input.category,
    title: input.title,
    body: input.body,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload_json: input.payloadJson ?? {},
  });

  if (error) {
    throw error;
  }
}
