import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClientPortalSessionPayload } from '@/lib/client-portal/session';
import { getCurrentClientPortalSession } from '@/lib/client-portal/session';

type PortalUserRow = {
  id: string;
  status: string;
};

export type ActiveClientPortalAccess = {
  db: ReturnType<typeof createSupabaseServerClient>;
  session: ClientPortalSessionPayload;
};

export async function getActiveClientPortalAccess(): Promise<ActiveClientPortalAccess | null> {
  const session = await getCurrentClientPortalSession();
  if (!session) {
    return null;
  }

  const db = createSupabaseServerClient();
  const { data: portalUser } = await db
    .from('client_portal_users')
    .select('id, status')
    .eq('id', session.portalUserId)
    .eq('org_id', session.orgId)
    .eq('client_id', session.clientId)
    .eq('email', session.email)
    .maybeSingle();

  const row = portalUser as PortalUserRow | null;
  if (!row || String(row.status || '') !== 'active') {
    return null;
  }

  return { db, session };
}

type MembershipRow = {
  user_id: string;
  role: string;
};

type AppUserRow = {
  id: string;
};

export async function resolvePortalUploadActorUserId(params: {
  db: ReturnType<typeof createSupabaseServerClient>;
  orgId: string;
  preferredUserId?: string | null;
}) {
  const preferred = String(params.preferredUserId ?? '').trim();
  if (preferred) {
    const { data: preferredUser } = await params.db
      .from('app_users')
      .select('id')
      .eq('id', preferred)
      .maybeSingle();

    if ((preferredUser as AppUserRow | null)?.id) {
      return preferred;
    }
  }

  const { data: memberships } = await params.db
    .from('memberships')
    .select('user_id, role')
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: true })
    .limit(30);

  const rows = (memberships as MembershipRow[] | null) ?? [];
  if (!rows.length) {
    return null;
  }

  const owner = rows.find((membership) => String(membership.role ?? '') === 'owner');
  return String(owner?.user_id ?? rows[0]?.user_id ?? '').trim() || null;
}
