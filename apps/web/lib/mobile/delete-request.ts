import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type DeleteRequestParams = {
  orgId?: string | null;
  userId?: string | null;
  fullName?: string | null;
  email: string;
  phone?: string | null;
  firmName?: string | null;
  message?: string | null;
  source?: 'app' | 'contact';
};

function isMissingColumnError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    (normalized.includes('column') && normalized.includes('does not exist')) ||
    (normalized.includes('could not find') && normalized.includes('column'))
  );
}

function isLegacySourceConstraintError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    normalized.includes('full_version_requests_source_check') ||
    (normalized.includes('check constraint') && normalized.includes('source'))
  );
}

function isLegacyUserIdForeignKeyError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    normalized.includes('full_version_requests_user_id_fkey') ||
    (normalized.includes('foreign key') && normalized.includes('user_id'))
  );
}

function toNullableText(value?: string | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export async function createDeleteRequest(
  db: SupabaseClient,
  params: DeleteRequestParams,
) {
  let includeTypeColumn = true;
  let includeUserId = Boolean(params.userId);
  let source = params.source ?? 'app';
  let lastError: { message?: string } | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const payload: Record<string, unknown> = {
      org_id: params.orgId ?? null,
      full_name: toNullableText(params.fullName),
      email: params.email.trim().toLowerCase(),
      phone: toNullableText(params.phone),
      firm_name: toNullableText(params.firmName),
      message: toNullableText(params.message) || 'طلب حذف حساب التطبيق',
      source,
      user_id: includeUserId ? params.userId ?? null : null,
    };

    if (includeTypeColumn) {
      payload.type = 'delete_request';
    }

    const { error } = await db.from('full_version_requests').insert(payload);
    lastError = error;

    if (!error) {
      return;
    }

    if (includeTypeColumn && isMissingColumnError(error.message)) {
      includeTypeColumn = false;
      continue;
    }

    if (source === 'app' && isLegacySourceConstraintError(error.message)) {
      source = 'contact';
      continue;
    }

    if (includeUserId && isLegacyUserIdForeignKeyError(error.message)) {
      includeUserId = false;
      continue;
    }

    break;
  }

  throw new Error(lastError?.message || 'تعذر تسجيل طلب حذف الحساب.');
}
