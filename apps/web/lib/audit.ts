import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getCurrentOrgIdForUser } from '@/lib/org';

type AuditLogInput = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput) {
  const [user, orgId] = await Promise.all([getCurrentAuthUser(), getCurrentOrgIdForUser()]);
  if (!user || !orgId) {
    return;
  }

  const supabase = createSupabaseServerRlsClient();

  try {
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      user_id: user.id,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // Never block business flows on audit failures in MVP.
  }
}

