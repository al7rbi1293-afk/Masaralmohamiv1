import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_ROLES = ['super_admin', 'operations', 'support', 'finance', 'readonly'] as const;
export type AppAdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'admin.overview.read',
  'admin.users.read',
  'admin.users.write',
  'admin.orgs.read',
  'admin.orgs.write',
  'admin.requests.read',
  'admin.requests.write',
  'admin.audit.read',
  'admin.partners.read',
  'admin.partners.write',
  'admin.bulk_email.send',
  'admin.surveys.read',
  'admin.surveys.write',
  'admin.integrations.read',
  'admin.integrations.write',
  'admin.payments.write',
  'admin.tools.email_test',
] as const;

export type AppAdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export type AppAdminContext = {
  userId: string;
  role: AppAdminRole;
  permissions: AppAdminPermission[];
};

type AppAdminRow = {
  user_id: string;
  role?: string | null;
  permissions?: unknown;
};

const ADMIN_PERMISSION_SET = new Set<string>(ADMIN_PERMISSIONS);
const ALL_ADMIN_PERMISSIONS = [...ADMIN_PERMISSIONS] as AppAdminPermission[];

const ROLE_PERMISSIONS: Record<AppAdminRole, AppAdminPermission[]> = {
  super_admin: [...ALL_ADMIN_PERMISSIONS],
  operations: [
    'admin.overview.read',
    'admin.users.read',
    'admin.users.write',
    'admin.orgs.read',
    'admin.orgs.write',
    'admin.requests.read',
    'admin.requests.write',
    'admin.audit.read',
    'admin.partners.read',
    'admin.partners.write',
    'admin.surveys.read',
  ],
  support: [
    'admin.overview.read',
    'admin.users.read',
    'admin.orgs.read',
    'admin.requests.read',
    'admin.requests.write',
    'admin.audit.read',
    'admin.partners.read',
    'admin.surveys.read',
  ],
  finance: [
    'admin.overview.read',
    'admin.partners.read',
    'admin.partners.write',
    'admin.requests.read',
    'admin.audit.read',
    'admin.payments.write',
  ],
  readonly: [
    'admin.overview.read',
    'admin.users.read',
    'admin.orgs.read',
    'admin.requests.read',
    'admin.audit.read',
    'admin.partners.read',
    'admin.surveys.read',
    'admin.integrations.read',
  ],
};

function normalizeAdminRole(role: unknown): AppAdminRole {
  if (typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role)) {
    return role as AppAdminRole;
  }
  return 'super_admin';
}

function normalizePermissionList(value: unknown): AppAdminPermission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry): entry is AppAdminPermission => ADMIN_PERMISSION_SET.has(entry));

  return Array.from(new Set(normalized));
}

function mergePermissions(role: AppAdminRole, customPermissions: AppAdminPermission[]) {
  return Array.from(new Set([...ROLE_PERMISSIONS[role], ...customPermissions]));
}

function isMissingAdminColumnsError(message?: string) {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes('app_admins') &&
    text.includes('column') &&
    (text.includes(' role ') || text.includes(' permissions ') || text.includes('role') || text.includes('permissions'))
  );
}

async function fetchAppAdminRow(db: SupabaseClient, userId: string) {
  const withRbacColumns = await db.from('app_admins').select('user_id, role, permissions').eq('user_id', userId).maybeSingle();

  if (!withRbacColumns.error) {
    return withRbacColumns.data as AppAdminRow | null;
  }

  if (!isMissingAdminColumnsError(withRbacColumns.error.message)) {
    throw withRbacColumns.error;
  }

  const fallback = await db.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (fallback.error) {
    throw fallback.error;
  }
  if (!fallback.data) {
    return null;
  }

  return {
    user_id: String((fallback.data as { user_id: string }).user_id),
    role: 'super_admin',
    permissions: [],
  } satisfies AppAdminRow;
}

export async function fetchAppAdminContextForUser(db: SupabaseClient, userId: string): Promise<AppAdminContext | null> {
  const row = await fetchAppAdminRow(db, userId);
  if (!row?.user_id) {
    return null;
  }

  const role = normalizeAdminRole(row.role);
  const customPermissions = normalizePermissionList(row.permissions);

  return {
    userId: row.user_id,
    role,
    permissions: mergePermissions(role, customPermissions),
  };
}

export function hasAdminPermissions(
  currentPermissions: AppAdminPermission[],
  required: AppAdminPermission | AppAdminPermission[],
) {
  const requiredList = Array.isArray(required) ? required : [required];
  if (requiredList.length === 0) return true;

  const current = new Set(currentPermissions);
  return requiredList.every((permission) => current.has(permission));
}
