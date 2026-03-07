import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import type { TemplateVersionVariable } from '@/lib/templates';

type ResolveTemplateContextParams = {
  orgId: string;
  userId: string;
  clientId: string | null;
  matterId: string | null;
  manualValues: Record<string, string>;
  variables: TemplateVersionVariable[];
};

type ResolveTemplateContextResult = {
  values: Record<string, string>;
  missingRequired: string[];
};

type OrgRow = {
  id: string;
  name: string | null;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ClientRow = {
  id: string;
  type: string;
  name: string;
  identity_no: string | null;
  commercial_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type MatterRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  summary: string | null;
  assigned_user_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
};

export async function resolveTemplateContext(
  params: ResolveTemplateContextParams,
): Promise<ResolveTemplateContextResult> {
  const supabase = createSupabaseServerRlsClient();
  const now = new Date();
  const computedValues = buildComputedValues(now);

  const [org, profile, appUser, client, matter] = await Promise.all([
    fetchOrg(supabase, params.orgId),
    fetchProfile(supabase, params.userId),
    fetchAppUser(supabase, params.userId),
    params.clientId ? fetchClient(supabase, params.orgId, params.clientId) : Promise.resolve(null),
    params.matterId ? fetchMatter(supabase, params.orgId, params.matterId) : Promise.resolve(null),
  ]);

  const context = {
    org: {
      id: org?.id ?? params.orgId,
      name: org?.name ?? '',
    },
    user: {
      id: params.userId,
      full_name: profile?.full_name ?? appUser?.full_name ?? '',
      email: appUser?.email ?? '',
      phone: profile?.phone ?? '',
    },
    client: client
      ? {
          id: client.id,
          type: client.type,
          name: client.name,
          identity_no: client.identity_no ?? '',
          commercial_no: client.commercial_no ?? '',
          email: client.email ?? '',
          phone: client.phone ?? '',
          notes: client.notes ?? '',
        }
      : null,
    matter: matter
      ? {
          id: matter.id,
          client_id: matter.client_id,
          title: matter.title,
          status: matter.status,
          summary: matter.summary ?? '',
          assigned_user_id: matter.assigned_user_id ?? '',
          is_private: matter.is_private,
          created_at: matter.created_at,
          updated_at: matter.updated_at,
        }
      : null,
  };

  const values: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const definition of params.variables ?? []) {
    const key = cleanKey(definition?.key);
    if (!key) continue;

    const valueFromSource = readVariableFromSource({
      definition,
      key,
      context,
      computedValues,
    });

    const manualOverride = normalizeValue(params.manualValues?.[key]);
    const defaultValue = normalizeValue(definition?.defaultValue);

    let resolved = manualOverride || valueFromSource || defaultValue;
    resolved = applyFormat(resolved, definition?.format ?? 'text');
    resolved = applyTransform(resolved, definition?.transform ?? 'none');

    if (definition?.required && !resolved) {
      missingRequired.push(key);
    }

    if (resolved) {
      values[key] = resolved;
    }
  }

  // Manual values always take precedence and can include keys outside the template definition.
  for (const [rawKey, rawValue] of Object.entries(params.manualValues ?? {})) {
    const key = cleanKey(rawKey);
    if (!key) continue;
    const value = normalizeValue(rawValue);
    if (!value) continue;
    values[key] = value;
  }

  return {
    values,
    missingRequired: Array.from(new Set(missingRequired)),
  };
}

function readVariableFromSource(params: {
  definition: TemplateVersionVariable;
  key: string;
  context: {
    org: Record<string, unknown>;
    user: Record<string, unknown>;
    client: Record<string, unknown> | null;
    matter: Record<string, unknown> | null;
  };
  computedValues: Record<string, string>;
}) {
  const source = params.definition?.source;
  const path = cleanPath(params.definition?.path);

  if (source === 'manual') {
    return '';
  }

  if (source === 'computed') {
    return readComputedValue(params.key, path, params.computedValues);
  }

  if (source === 'client') {
    if (!params.context.client) return '';
    const effectivePath = path || stripRootFromKey(params.key, 'client');
    return normalizeValue(readByPath(params.context.client, effectivePath));
  }

  if (source === 'matter') {
    if (!params.context.matter) return '';
    const effectivePath = path || stripRootFromKey(params.key, 'matter');
    return normalizeValue(readByPath(params.context.matter, effectivePath));
  }

  if (source === 'org') {
    const effectivePath = path || stripRootFromKey(params.key, 'org');
    return normalizeValue(readByPath(params.context.org, effectivePath));
  }

  if (source === 'user') {
    const effectivePath = path || stripRootFromKey(params.key, 'user');
    return normalizeValue(readByPath(params.context.user, effectivePath));
  }

  return '';
}

function readComputedValue(key: string, path: string, computedValues: Record<string, string>) {
  if (computedValues[key]) {
    return computedValues[key];
  }

  if (path && computedValues[path]) {
    return computedValues[path];
  }

  if (path && computedValues[`date.${path}`]) {
    return computedValues[`date.${path}`];
  }

  return '';
}

function applyFormat(value: string, format: TemplateVersionVariable['format']) {
  if (!value) return '';

  if (format === 'date') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return formatGregorianDate(parsed);
    }
  }

  if (format === 'number') {
    const normalized = value.replaceAll(',', '').trim();
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return String(parsed);
    }
  }

  return value;
}

function applyTransform(value: string, transform: TemplateVersionVariable['transform']) {
  if (!value) return '';

  if (transform === 'upper') {
    return value.toUpperCase();
  }

  if (transform === 'lower') {
    return value.toLowerCase();
  }

  return value;
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cleanKey(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized.slice(0, 160);
}

function cleanPath(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, 160) : '';
}

function stripRootFromKey(key: string, root: string) {
  const prefix = `${root}.`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : '';
}

function readByPath(target: Record<string, unknown>, path: string) {
  if (!path) return '';

  const parts = path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let cursor: unknown = target;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') {
      return '';
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function buildComputedValues(now: Date) {
  return {
    'date.today': formatGregorianDate(now),
    'date.iso': now.toISOString(),
    'date.hijri_today': formatHijriDate(now),
    today: formatGregorianDate(now),
    iso: now.toISOString(),
    hijri_today: formatHijriDate(now),
  };
}

function formatGregorianDate(value: Date) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

function formatHijriDate(value: Date) {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(value);
  } catch {
    return formatGregorianDate(value);
  }
}

async function fetchOrg(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as OrgRow | null) ?? null;
}

async function fetchProfile(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as UserProfileRow | null) ?? null;
}

async function fetchAppUser(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('app_users')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as AppUserRow | null) ?? null;
}

async function fetchClient(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  clientId: string,
) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, type, name, identity_no, commercial_no, email, phone, notes')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as ClientRow | null) ?? null;
}

async function fetchMatter(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  matterId: string,
) {
  const { data, error } = await supabase
    .from('matters')
    .select('id, client_id, title, status, summary, assigned_user_id, is_private, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as MatterRow | null) ?? null;
}
