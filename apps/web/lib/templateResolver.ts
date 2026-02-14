import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import type {
  TemplateVersionVariable,
  TemplateVariableFormat,
  TemplateVariableSource,
  TemplateVariableTransform,
} from '@/lib/templates';

export type ResolveTemplateContextArgs = {
  orgId: string;
  userId: string;
  clientId?: string | null;
  matterId?: string | null;
  manualValues?: Record<string, string>;
  variables?: TemplateVersionVariable[];
};

export type ResolvedTemplateContext = {
  values: Record<string, string>;
  missingRequired: string[];
  usedSources: {
    client: boolean;
    matter: boolean;
    org: boolean;
    user: boolean;
    computed: boolean;
    manual: boolean;
  };
};

type OrgRow = { id: string; name: string };
type ProfileRow = { full_name: string; phone: string | null };
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

export async function resolveTemplateContext(args: ResolveTemplateContextArgs): Promise<ResolvedTemplateContext> {
  const orgId = String(args.orgId || '').trim();
  const userId = String(args.userId || '').trim();
  const clientId = args.clientId ? String(args.clientId).trim() : '';
  const matterId = args.matterId ? String(args.matterId).trim() : '';
  const manualValues = args.manualValues ?? {};
  const variables = Array.isArray(args.variables) ? args.variables : [];

  if (!orgId || !userId) {
    throw new Error('invalid_context');
  }

  const currentUser = await getCurrentAuthUser();
  if (!currentUser || currentUser.id !== userId) {
    throw new Error('not_authenticated');
  }

  const supabase = createSupabaseServerRlsClient();

  const [{ data: org }, { data: profile }, { data: client }, { data: matter }] = await Promise.all([
    supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
    supabase.from('profiles').select('full_name, phone').eq('user_id', userId).maybeSingle(),
    clientId
      ? supabase
          .from('clients')
          .select('id, type, name, identity_no, commercial_no, email, phone, notes')
          .eq('org_id', orgId)
          .eq('id', clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    matterId
      ? supabase
          .from('matters')
          .select('id, client_id, title, status, summary, assigned_user_id, is_private, created_at, updated_at')
          .eq('org_id', orgId)
          .eq('id', matterId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!org) {
    // RLS should prevent access; return a clear error.
    throw new Error('org_not_found');
  }

  const computed = computeBuiltInValues(org as OrgRow);

  // Start with computed helper values so templates can use them even if not declared.
  const values: Record<string, string> = { ...computed.values };
  const missingRequired: string[] = [...computed.missingKeys];

  const usedSources = {
    client: Boolean(client),
    matter: Boolean(matter),
    org: true,
    user: true,
    computed: true,
    manual: Object.keys(manualValues).length > 0,
  };

  // Add base fields (even if not declared as variables).
  values['org.id'] = String((org as OrgRow).id);
  values['org.name'] = String((org as OrgRow).name ?? '');
  values['user.id'] = currentUser.id;
  values['user.email'] = currentUser.email;
  values['user.name'] = profile ? String((profile as ProfileRow).full_name ?? '') : '';
  values['user.phone'] = profile?.phone ? String((profile as ProfileRow).phone) : '';

  if (client) {
    const c = client as unknown as ClientRow;
    values['client.id'] = String(c.id);
    values['client.type'] = String(c.type ?? '');
    values['client.name'] = String(c.name ?? '');
    values['client.identity_no'] = c.identity_no ? String(c.identity_no) : '';
    values['client.commercial_no'] = c.commercial_no ? String(c.commercial_no) : '';
    values['client.email'] = c.email ? String(c.email) : '';
    values['client.phone'] = c.phone ? String(c.phone) : '';
    values['client.notes'] = c.notes ? String(c.notes) : '';
  }

  if (matter) {
    const m = matter as unknown as MatterRow;
    values['matter.id'] = String(m.id);
    values['matter.client_id'] = String(m.client_id ?? '');
    values['matter.title'] = String(m.title ?? '');
    values['matter.status'] = String(m.status ?? '');
    values['matter.summary'] = m.summary ? String(m.summary) : '';
    values['matter.created_at'] = m.created_at ? formatDateArabic(new Date(m.created_at)) : '';
    values['matter.updated_at'] = m.updated_at ? formatDateArabic(new Date(m.updated_at)) : '';
  }

  // If variable definitions are provided, resolve values strictly by source/path rules.
  if (variables.length) {
    const normalizedManual: Record<string, string> = {};
    for (const [k, v] of Object.entries(manualValues)) {
      normalizedManual[String(k).trim()] = String(v ?? '').trim();
    }

    const resolvedByVariables: Record<string, string> = {};
    const requiredMissing: string[] = [];
    const usedByVars: Record<TemplateVariableSource, boolean> = {
      client: false,
      matter: false,
      org: false,
      user: false,
      computed: false,
      manual: false,
    };

    for (const variable of variables) {
      const key = String(variable.key ?? '').trim();
      if (!key) continue;

      usedByVars[variable.source] = true;

      let raw: unknown = '';
      switch (variable.source) {
        case 'client':
          raw = client ? getPathValue(client, variable.path) : '';
          break;
        case 'matter':
          raw = matter ? getPathValue(matter, variable.path) : '';
          break;
        case 'org':
          raw = getPathValue(org, variable.path);
          break;
        case 'user': {
          const userObj = {
            id: currentUser.id,
            email: currentUser.email,
            name: profile ? String((profile as ProfileRow).full_name ?? '') : '',
            phone: profile?.phone ? String((profile as ProfileRow).phone) : '',
          };
          raw = getPathValue(userObj, variable.path);
          break;
        }
        case 'computed':
          raw = computed.values[key] ?? '';
          break;
        case 'manual':
          raw = normalizedManual[key] ?? variable.defaultValue ?? '';
          break;
        default:
          raw = '';
      }

      const formatted = applyFormatting(String(raw ?? ''), variable.format, variable.transform);
      resolvedByVariables[key] = formatted;

      if (variable.required && !formatted.trim()) {
        requiredMissing.push(key);
      }
    }

    usedSources.client = usedSources.client && usedByVars.client;
    usedSources.matter = usedSources.matter && usedByVars.matter;
    usedSources.org = true && usedByVars.org;
    usedSources.user = true && usedByVars.user;
    usedSources.computed = true && usedByVars.computed;
    usedSources.manual = (Object.keys(manualValues).length > 0 || usedByVars.manual) && usedByVars.manual;

    Object.assign(values, resolvedByVariables);
    missingRequired.push(...requiredMissing);
  } else {
    // No variable definitions: still merge manual values.
    for (const [k, v] of Object.entries(manualValues)) {
      const key = String(k || '').trim();
      if (!key) continue;
      values[key] = String(v ?? '').trim();
    }
  }

  return {
    values,
    missingRequired: Array.from(new Set(missingRequired)).filter(Boolean),
    usedSources,
  };
}

function computeBuiltInValues(org: OrgRow) {
  const now = new Date();
  const iso = toIsoDate(now);

  const values: Record<string, string> = {
    'date.today': formatDateArabic(now),
    'date.today_iso': iso,
    'doc.serial': '',
    'org.name': String(org.name ?? ''),
  };

  const missingKeys: string[] = [];

  try {
    values['date.hijri_today'] = formatHijriArabic(now);
  } catch {
    missingKeys.push('date.hijri_today');
  }

  return { values, missingKeys };
}

function getPathValue(obj: unknown, path?: string | null) {
  const rawPath = String(path ?? '').trim();
  if (!rawPath) return '';

  const parts = rawPath.split('.').filter(Boolean);
  let current: any = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as any)[part];
  }

  return current ?? '';
}

function applyFormatting(
  value: string,
  format?: TemplateVariableFormat | null,
  transform?: TemplateVariableTransform | null,
) {
  let next = String(value ?? '').trim();

  if (format === 'date') {
    const parsed = new Date(next);
    if (!Number.isNaN(parsed.getTime())) {
      next = formatDateArabic(parsed);
    }
  }

  if (transform === 'upper') {
    next = next.toUpperCase();
  } else if (transform === 'lower') {
    next = next.toLowerCase();
  }

  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateArabic(date: Date) {
  return new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function formatHijriArabic(date: Date) {
  // Uses built-in Intl Hijri calendar if available.
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

