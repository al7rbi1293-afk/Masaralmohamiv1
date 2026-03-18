import 'server-only';

import { isUserAppAdmin } from '@/lib/admin';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';
import { integrationError } from '../errors';
import type { IntegrationActor, IntegrationActorRole } from '../models';

type RequireIntegrationActorOptions = {
  orgId?: string | null;
  allowedRoles?: IntegrationActorRole[];
};

const DEFAULT_ALLOWED_ROLES: IntegrationActorRole[] = ['owner'];

export async function requireIntegrationActor(
  options: RequireIntegrationActorOptions = {},
): Promise<IntegrationActor> {
  const user = await getCurrentAuthUser();
  if (!user) {
    throw integrationError('not_authenticated', 'الرجاء تسجيل الدخول.', { statusCode: 401 });
  }

  const allowedRoles = options.allowedRoles ?? DEFAULT_ALLOWED_ROLES;
  const requestedOrgId = normalizeOptionalString(options.orgId);
  const appAdmin = await isUserAppAdmin(user.id);

  if (appAdmin && requestedOrgId && allowedRoles.includes('admin')) {
    return {
      userId: user.id,
      orgId: requestedOrgId,
      role: 'admin',
      isAppAdmin: true,
    };
  }

  const orgId = requestedOrgId ?? (await requireOrgIdForUser());
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw integrationError('membership_lookup_failed', 'تعذر التحقق من صلاحيات المكتب.', {
      statusCode: 500,
      details: { message: error.message },
    });
  }

  const role = data?.role as IntegrationActorRole | undefined;
  if (!role) {
    throw integrationError('not_authorized', 'لا تملك صلاحية الوصول لهذا المكتب.', { statusCode: 403 });
  }

  if (!allowedRoles.includes(role) && !(appAdmin && allowedRoles.includes('admin'))) {
    throw integrationError('not_authorized', 'لا تملك صلاحية تنفيذ هذا الإجراء.', { statusCode: 403 });
  }

  return {
    userId: user.id,
    orgId,
    role,
    isAppAdmin: appAdmin,
  };
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
