import 'server-only';

import { headers } from 'next/headers';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';

type LogAuditParams = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  req?: Request;
};

export async function logAudit({
  action,
  entityType = null,
  entityId = null,
  meta = {},
  req,
}: LogAuditParams) {
  try {
    const orgId = await requireOrgIdForUser();
    const user = await getCurrentAuthUser();
    const supabase = createSupabaseServerRlsClient();

    const headerStore = req ? req.headers : headers();
    const userAgent = headerStore.get('user-agent') || null;

    const forwardedFor = headerStore.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0]?.trim() || headerStore.get('x-real-ip') || null;

    const { error } = await supabase.from('audit_logs').insert({
      org_id: orgId,
      user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta,
      ip,
      user_agent: userAgent,
    });

    if (error) {
      logError('audit_log_insert_failed', { message: error.message, action });
    }
  } catch (error) {
    logError('audit_log_insert_failed', {
      message: error instanceof Error ? error.message : 'unknown',
      action,
    });
  }
}

