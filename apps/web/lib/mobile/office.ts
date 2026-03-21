import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgRole } from '@/lib/org';
import { isMissingColumnError } from '@/lib/shared-utils';
import type { MobileAppSessionContext } from '@/lib/mobile/auth';

type MatterClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type MatterRow = {
  id: string;
  org_id: string;
  client_id: string | null;
  title: string;
  status: string;
  summary: string | null;
  case_type: string | null;
  claims: string | null;
  assigned_user_id: string | null;
  is_private: boolean;
  najiz_case_number: string | null;
  created_at: string;
  updated_at: string;
  client: MatterClient | MatterClient[] | null;
};

const MATTER_SELECT =
  'id, org_id, client_id, title, status, summary, najiz_case_number, case_type, claims, assigned_user_id, is_private, created_at, updated_at, client:clients(id, name, email, phone)';

function isUuidLike(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? '').trim());
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function cleanQuery(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.replace(/\s+/g, ' ') : '';
}

function buildSearchPattern(value: string | null | undefined) {
  const normalized = cleanQuery(value).replace(/[(),]/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return `%${normalized}%`;
}

async function listMatterMemberIdsForUser(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('matter_members')
    .select('matter_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return ((data as Array<{ matter_id?: string | null }> | null) ?? [])
    .map((row) => String(row.matter_id ?? '').trim())
    .filter(isUuidLike);
}

function buildMatterVisibilityClauses(userId: string, memberMatterIds: string[]) {
  const safeMemberMatterIds = Array.from(new Set(memberMatterIds.filter(isUuidLike)));
  return ['is_private.eq.false', `assigned_user_id.eq.${userId}`, ...safeMemberMatterIds.map((id) => `id.eq.${id}`)];
}

function buildSearchVisibilityFilter(pattern: string, visibilityClauses: string[]) {
  const searchClauses = [`title.ilike.${pattern}`, `summary.ilike.${pattern}`];
  const combined: string[] = [];

  for (const visibility of visibilityClauses) {
    for (const search of searchClauses) {
      combined.push(`and(${visibility},${search})`);
    }
  }

  return combined.join(',');
}

function normalizeMatter(row: MatterRow) {
  const client = pickRelation(row.client);
  return {
    id: row.id,
    org_id: row.org_id,
    client_id: row.client_id,
    title: row.title,
    status: row.status,
    summary: row.summary ?? null,
    case_type: row.case_type ?? null,
    claims: row.claims ?? null,
    assigned_user_id: row.assigned_user_id ?? null,
    is_private: Boolean(row.is_private),
    najiz_case_number: row.najiz_case_number ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client: client
      ? {
          id: client.id,
          name: client.name,
          email: client.email ?? null,
          phone: client.phone ?? null,
        }
      : null,
  };
}

async function canAccessMatter(params: {
  db: SupabaseClient;
  matterId: string;
  userId: string;
  role: OrgRole | null;
  assignedUserId?: string | null;
  isPrivate: boolean;
}) {
  if (!params.isPrivate) {
    return true;
  }

  if (params.role === 'owner') {
    return true;
  }

  if (String(params.assignedUserId ?? '') === params.userId) {
    return true;
  }

  const { data, error } = await params.db
    .from('matter_members')
    .select('matter_id')
    .eq('matter_id', params.matterId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function getOfficeBootstrapData(context: MobileAppSessionContext) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const [clientsRes, mattersRes, tasksRes, invoicesRes] = await Promise.all([
    context.db.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    context.db
      .from('matters')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .neq('status', 'closed')
      .neq('status', 'archived'),
    context.db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .neq('status', 'done')
      .neq('status', 'canceled'),
    context.db
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .neq('status', 'paid'),
  ]);

  return {
    user: context.user,
    org: context.org,
    role: {
      name: context.role,
      is_admin: context.isAdmin,
      has_partner_access: context.hasPartnerAccess,
    },
    counts: {
      clients: clientsRes.count ?? 0,
      open_matters: mattersRes.count ?? 0,
      open_tasks: tasksRes.count ?? 0,
      unpaid_invoices: invoicesRes.count ?? 0,
    },
  };
}

export async function listOfficeMatters(
  context: MobileAppSessionContext,
  params: {
    q?: string | null;
    status?: string | null;
    clientId?: string | null;
    page?: number;
    limit?: number;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = cleanQuery(params.q);
  const status = cleanQuery(params.status) || 'all';
  const clientId = cleanQuery(params.clientId) || null;

  let query = context.db
    .from('matters')
    .select(MATTER_SELECT, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (context.role !== 'owner') {
    const memberMatterIds = await listMatterMemberIdsForUser(context.db, context.user.id);
    const visibilityClauses = buildMatterVisibilityClauses(context.user.id, memberMatterIds);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(buildSearchVisibilityFilter(pattern, visibilityClauses));
    } else {
      query = query.or(visibilityClauses.join(','));
    }
  } else if (q) {
    const pattern = `%${q}%`;
    query = query.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    data: ((data as MatterRow[] | null) ?? []).map(normalizeMatter),
    page,
    limit,
    total: count ?? 0,
  };
}

async function listMatterTasks(db: SupabaseClient, orgId: string, matterId: string) {
  let data: Array<Record<string, unknown>> | null = null;
  let error: unknown = null;

  ({ data, error } = await db
    .from('tasks')
    .select('id, title, status, priority, due_at, assignee_id, is_archived, updated_at')
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(20));

  if (error && isMissingColumnError(error, 'tasks', 'is_archived')) {
    ({ data, error } = await db
      .from('tasks')
      .select('id, title, status, priority, due_at, assignee_id, updated_at')
      .eq('org_id', orgId)
      .eq('matter_id', matterId)
      .order('updated_at', { ascending: false })
      .limit(20));
  }

  if (error) {
    throw error;
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((task) => ({
    id: String(task.id ?? ''),
    title: String(task.title ?? ''),
    status: String(task.status ?? ''),
    priority: String(task.priority ?? ''),
    due_at: task.due_at ? String(task.due_at) : null,
    assignee_id: task.assignee_id ? String(task.assignee_id) : null,
    updated_at: task.updated_at ? String(task.updated_at) : null,
  }));
}

async function listMatterDocuments(db: SupabaseClient, orgId: string, matterId: string) {
  let data: Array<Record<string, unknown>> | null = null;
  let error: unknown = null;

  ({ data, error } = await db
    .from('documents')
    .select('id, title, created_at, is_archived')
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(20));

  if (error && isMissingColumnError(error, 'documents', 'is_archived')) {
    ({ data, error } = await db
      .from('documents')
      .select('id, title, created_at')
      .eq('org_id', orgId)
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })
      .limit(20));
  }

  if (error) {
    throw error;
  }

  const documents = ((data as Array<Record<string, unknown>> | null) ?? []).map((document) => ({
    id: String(document.id ?? ''),
    title: String(document.title ?? ''),
    created_at: document.created_at ? String(document.created_at) : null,
  }));

  const documentIds = documents.map((document) => document.id).filter(Boolean);
  const latestVersionByDocument = new Map<string, Record<string, unknown>>();

  if (documentIds.length) {
    const { data: versions, error: versionsError } = await db
      .from('document_versions')
      .select('document_id, version_no, file_name, file_size, mime_type, created_at, storage_path')
      .eq('org_id', orgId)
      .in('document_id', documentIds)
      .order('version_no', { ascending: false })
      .order('created_at', { ascending: false });

    if (versionsError) {
      throw versionsError;
    }

    for (const version of (versions as Array<Record<string, unknown>> | null) ?? []) {
      const documentId = String(version.document_id ?? '').trim();
      if (!documentId || latestVersionByDocument.has(documentId)) {
        continue;
      }
      latestVersionByDocument.set(documentId, version);
    }
  }

  return documents.map((document) => {
    const latest = latestVersionByDocument.get(document.id);
    return {
      ...document,
      latest_version: latest
        ? {
            version_no: Number(latest.version_no ?? 1),
            file_name: String(latest.file_name ?? ''),
            file_size: Number(latest.file_size ?? 0),
            mime_type: latest.mime_type ? String(latest.mime_type) : null,
            created_at: latest.created_at ? String(latest.created_at) : null,
            storage_path: latest.storage_path ? String(latest.storage_path) : null,
          }
        : null,
    };
  });
}

export async function getOfficeMatterDetails(context: MobileAppSessionContext, matterId: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const { data, error } = await context.db
    .from('matters')
    .select(MATTER_SELECT)
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const matter = normalizeMatter(data as MatterRow);
  const allowed = await canAccessMatter({
    db: context.db,
    matterId,
    userId: context.user.id,
    role: context.role,
    assignedUserId: matter.assigned_user_id,
    isPrivate: matter.is_private,
  });

  if (!allowed) {
    return null;
  }

  const [assigneeRes, eventsRes, communicationsRes, tasks, documents] = await Promise.all([
    matter.assigned_user_id
      ? context.db
          .from('app_users')
          .select('id, full_name, email')
          .eq('id', matter.assigned_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.db
      .from('matter_events')
      .select('id, type, note, event_date, created_at, creator:app_users(full_name)')
      .eq('org_id', orgId)
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })
      .limit(10),
    context.db
      .from('matter_communications')
      .select('id, sender, message, created_at')
      .eq('org_id', orgId)
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false })
      .limit(10),
    listMatterTasks(context.db, orgId, matterId),
    listMatterDocuments(context.db, orgId, matterId),
  ]);

  return {
    ...matter,
    assigned_user: assigneeRes.data
      ? {
          id: String((assigneeRes.data as any).id ?? ''),
          full_name: String((assigneeRes.data as any).full_name ?? ''),
          email: (assigneeRes.data as any).email ? String((assigneeRes.data as any).email) : null,
        }
      : null,
    events: ((eventsRes.data as Array<Record<string, unknown>> | null) ?? []).map((event) => {
      const creator = pickRelation<{ full_name: string | null }>(event.creator as any);
      return {
        id: String(event.id ?? ''),
        type: String(event.type ?? ''),
        note: event.note ? String(event.note) : null,
        event_date: event.event_date ? String(event.event_date) : null,
        created_at: event.created_at ? String(event.created_at) : null,
        created_by_name: creator?.full_name ? String(creator.full_name) : null,
      };
    }),
    communications: ((communicationsRes.data as Array<Record<string, unknown>> | null) ?? []).map((item) => ({
      id: String(item.id ?? ''),
      sender: String(item.sender ?? ''),
      message: String(item.message ?? ''),
      created_at: item.created_at ? String(item.created_at) : null,
    })),
    tasks,
    documents,
  };
}

type OfficeListParams = {
  q?: string | null;
  status?: string | null;
  archived?: 'active' | 'archived' | 'all' | null;
  matterId?: string | null;
  clientId?: string | null;
  page?: number;
  limit?: number;
  from?: string | null;
  to?: string | null;
  mine?: boolean | null;
};

type OfficeTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  updated_at: string | null;
  is_archived: boolean;
  matter_id: string | null;
  matter_title: string | null;
  assignee_id: string | null;
  is_overdue: boolean;
};

type OfficeDocumentItem = {
  id: string;
  title: string;
  description: string | null;
  folder: string;
  created_at: string | null;
  is_archived: boolean;
  matter_id: string | null;
  matter_title: string | null;
  client_id: string | null;
  client_name: string | null;
  tags: string[];
  latest_version: {
    version_no: number;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    created_at: string | null;
    storage_path: string;
  } | null;
};

type OfficeBillingItem = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  is_archived?: boolean;
  matter_id: string | null;
  matter_title: string | null;
  client_id: string;
  client_name: string | null;
};

type OfficeCalendarItem = {
  id: string;
  kind: 'hearing' | 'meeting' | 'event' | 'task' | 'invoice';
  title: string;
  date: string | null;
  start_at: string | null;
  end_at: string | null;
  matter_id: string | null;
  matter_title: string | null;
  note: string | null;
  source_label: string;
};

type OfficeNotificationItem = {
  id: string;
  source: string | null;
  category: string | null;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
};

function normalizeArchiveFlag(value: string | null | undefined) {
  const cleaned = cleanQuery(value);
  return cleaned === 'archived' || cleaned === 'all' ? (cleaned as 'archived' | 'all') : 'active';
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeOfficeTags(value: unknown) {
  return normalizeStringList(value);
}

function toOptionalString(value: unknown) {
  const cleaned = String(value ?? '').trim();
  return cleaned || null;
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

export async function listOfficeTasks(
  context: MobileAppSessionContext,
  params: OfficeListParams = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = cleanQuery(params.q);
  const status = cleanQuery(params.status) || 'all';
  const archived = normalizeArchiveFlag(params.archived);
  const matterId = cleanQuery(params.matterId) || null;
  const mine = Boolean(params.mine);

  let query = context.db
    .from('tasks')
    .select(
      'id, title, description, status, priority, due_at, updated_at, is_archived, matter_id, assignee_id, matter:matters(id, title)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') query = query.eq('status', status);
  if (matterId) query = query.eq('matter_id', matterId);
  if (archived === 'active') query = query.eq('is_archived', false);
  if (archived === 'archived') query = query.eq('is_archived', true);
  if (mine) query = query.eq('assignee_id', context.user.id);
  const taskPattern = buildSearchPattern(q);
  if (taskPattern) query = query.or(`title.ilike.${taskPattern},description.ilike.${taskPattern}`);

  let { data, error, count } = await query;
  if (error && isMissingColumnError(error, 'tasks', 'is_archived')) {
    let legacyQuery = context.db
      .from('tasks')
      .select(
        'id, title, description, status, priority, due_at, updated_at, matter_id, assignee_id, matter:matters(id, title)',
        { count: 'exact' },
      )
      .eq('org_id', orgId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (status !== 'all') legacyQuery = legacyQuery.eq('status', status);
    if (matterId) legacyQuery = legacyQuery.eq('matter_id', matterId);
    if (mine) legacyQuery = legacyQuery.eq('assignee_id', context.user.id);
    if (taskPattern) legacyQuery = legacyQuery.or(`title.ilike.${taskPattern},description.ilike.${taskPattern}`);

    ({ data, error, count } = await (legacyQuery as any));
  }

  if (error) throw error;

  const rows = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const matter = pickRelation<{ id: string; title: string }>(row.matter as any);
    const dueAt = toOptionalString(row.due_at);
    return {
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      description: toOptionalString(row.description),
      status: String(row.status ?? ''),
      priority: String(row.priority ?? ''),
      due_at: dueAt,
      updated_at: toOptionalString(row.updated_at),
      is_archived: Boolean((row as any).is_archived ?? false),
      matter_id: toOptionalString(row.matter_id),
      assignee_id: toOptionalString(row.assignee_id),
      matter_title: matter?.title ?? null,
      is_overdue: Boolean(dueAt && new Date(dueAt).getTime() < Date.now() && !['done', 'canceled'].includes(String(row.status ?? ''))),
    } satisfies OfficeTaskItem;
  });

  return {
    data: rows,
    page,
    limit,
    total: count ?? rows.length,
  };
}

export async function listOfficeDocuments(
  context: MobileAppSessionContext,
  params: OfficeListParams = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = cleanQuery(params.q);
  const archived = normalizeArchiveFlag(params.archived);
  const matterId = cleanQuery(params.matterId) || null;
  const clientId = cleanQuery(params.clientId) || null;

  let query = context.db
    .from('documents')
    .select(
      'id, title, description, folder, tags, created_at, is_archived, matter_id, client_id, matter:matters(id, title), client:clients(id, name)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (archived === 'active') query = query.eq('is_archived', false);
  if (archived === 'archived') query = query.eq('is_archived', true);
  if (matterId) query = query.eq('matter_id', matterId);
  if (clientId) query = query.eq('client_id', clientId);
  const documentPattern = buildSearchPattern(q);
  if (documentPattern) query = query.or(`title.ilike.${documentPattern},description.ilike.${documentPattern}`);

  let { data, error, count } = await query;
  if (error && isMissingColumnError(error, 'documents', 'is_archived')) {
    let legacyQuery = context.db
      .from('documents')
      .select(
        'id, title, description, folder, tags, created_at, matter_id, client_id, matter:matters(id, title), client:clients(id, name)',
        { count: 'exact' },
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (matterId) legacyQuery = legacyQuery.eq('matter_id', matterId);
    if (clientId) legacyQuery = legacyQuery.eq('client_id', clientId);
    if (documentPattern) legacyQuery = legacyQuery.or(`title.ilike.${documentPattern},description.ilike.${documentPattern}`);

    ({ data, error, count } = await (legacyQuery as any));
  }

  if (error) throw error;

  const docs = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    description: toOptionalString(row.description),
    folder: String(row.folder ?? ''),
    created_at: toOptionalString(row.created_at),
    is_archived: Boolean((row as any).is_archived ?? false),
    matter_id: toOptionalString(row.matter_id),
    client_id: toOptionalString(row.client_id),
    matter_title: pickRelation<{ id: string; title: string }>(row.matter as any)?.title ?? null,
    client_name: pickRelation<{ id: string; name: string }>(row.client as any)?.name ?? null,
    tags: normalizeOfficeTags(row.tags),
    latest_version: null as OfficeDocumentItem['latest_version'],
  }));

  const documentIds = docs.map((doc) => doc.id).filter(Boolean);
  const latestByDoc = new Map<string, OfficeDocumentItem['latest_version']>();
  if (documentIds.length) {
    const { data: versions, error: versionsError } = await context.db
      .from('document_versions')
      .select('document_id, version_no, file_name, file_size, mime_type, created_at, storage_path')
      .eq('org_id', orgId)
      .in('document_id', documentIds)
      .order('version_no', { ascending: false })
      .order('created_at', { ascending: false });

    if (versionsError) throw versionsError;

    for (const version of ((versions as Array<Record<string, unknown>> | null) ?? [])) {
      const documentId = String(version.document_id ?? '').trim();
      if (!documentId || latestByDoc.has(documentId)) continue;
      latestByDoc.set(documentId, {
        version_no: Number(version.version_no ?? 1),
        file_name: String(version.file_name ?? ''),
        file_size: Number(version.file_size ?? 0),
        mime_type: version.mime_type ? String(version.mime_type) : null,
        created_at: version.created_at ? String(version.created_at) : null,
        storage_path: String(version.storage_path ?? ''),
      });
    }
  }

  return {
    data: docs.map((doc) => ({
      ...doc,
      latest_version: latestByDoc.get(doc.id) ?? null,
    })),
    page,
    limit,
    total: count ?? docs.length,
  };
}

export async function listOfficeBilling(
  context: MobileAppSessionContext,
  params: OfficeListParams = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const status = cleanQuery(params.status) || 'all';
  const clientId = cleanQuery(params.clientId) || null;
  const archived = normalizeArchiveFlag(params.archived);

  let invoicesQuery = context.db
    .from('invoices')
    .select('id, number, total, currency, status, issued_at, due_at, is_archived, matter_id, client_id, matter:matters(id, title), client:clients(id, name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('issued_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') invoicesQuery = invoicesQuery.eq('status', status);
  if (clientId) invoicesQuery = invoicesQuery.eq('client_id', clientId);
  if (archived === 'active') invoicesQuery = invoicesQuery.eq('is_archived', false);
  if (archived === 'archived') invoicesQuery = invoicesQuery.eq('is_archived', true);

  let { data: invoicesData, error: invoicesError, count: invoiceCount } = await invoicesQuery;
  if (invoicesError && isMissingColumnError(invoicesError, 'invoices', 'is_archived')) {
    let legacyQuery = context.db
      .from('invoices')
      .select('id, number, total, currency, status, issued_at, due_at, matter_id, client_id, matter:matters(id, title), client:clients(id, name)', { count: 'exact' })
      .eq('org_id', orgId)
      .order('issued_at', { ascending: false })
      .range(from, to);
    if (status !== 'all') legacyQuery = legacyQuery.eq('status', status);
    if (clientId) legacyQuery = legacyQuery.eq('client_id', clientId);
    ({ data: invoicesData, error: invoicesError, count: invoiceCount } = await (legacyQuery as any));
  }
  if (invoicesError) throw invoicesError;

  let quotesQuery = context.db
    .from('quotes')
    .select('id, number, total, currency, status, created_at, client_id, matter_id, matter:matters(id, title), client:clients(id, name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status !== 'all') quotesQuery = quotesQuery.eq('status', status);
  if (clientId) quotesQuery = quotesQuery.eq('client_id', clientId);

  const { data: quotesData, error: quotesError, count: quoteCount } = await quotesQuery;
  if (quotesError) throw quotesError;

  const invoices = ((invoicesData as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id ?? ''),
    number: String(row.number ?? ''),
    total: toMoney(row.total),
    currency: String(row.currency ?? 'SAR'),
    status: String(row.status ?? ''),
    issued_at: toOptionalString(row.issued_at),
    due_at: toOptionalString(row.due_at),
    is_archived: Boolean((row as any).is_archived ?? false),
    matter_id: toOptionalString(row.matter_id),
    matter_title: pickRelation<{ id: string; title: string }>(row.matter as any)?.title ?? null,
    client_id: String(row.client_id ?? ''),
    client_name: pickRelation<{ id: string; name: string }>(row.client as any)?.name ?? null,
  })) satisfies OfficeBillingItem[];

  const quotes = ((quotesData as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id ?? ''),
    number: String(row.number ?? ''),
    total: toMoney(row.total),
    currency: String(row.currency ?? 'SAR'),
    status: String(row.status ?? ''),
    created_at: toOptionalString(row.created_at),
    matter_id: toOptionalString(row.matter_id),
    matter_title: pickRelation<{ id: string; title: string }>(row.matter as any)?.title ?? null,
    client_id: String(row.client_id ?? ''),
    client_name: pickRelation<{ id: string; name: string }>(row.client as any)?.name ?? null,
  }));

  return {
    invoices: {
      data: invoices,
      page,
      limit,
      total: invoiceCount ?? invoices.length,
    },
    quotes: {
      data: quotes,
      page,
      limit,
      total: quoteCount ?? quotes.length,
    },
  };
}

export async function listOfficeCalendar(
  context: MobileAppSessionContext,
  params: OfficeListParams = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const from = params.from?.trim() || new Date().toISOString();
  const to =
    params.to?.trim() ||
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const mine = Boolean(params.mine);

  const [eventsRes, tasksRes, invoicesRes] = await Promise.all([
    context.db
      .from('calendar_events')
      .select('id, title, description, location, start_at, end_at, all_day, matter_id, matters(title)')
      .eq('org_id', orgId)
      .gte('start_at', from)
      .lt('start_at', to)
      .order('start_at', { ascending: true })
      .limit(50),
    context.db
      .from('tasks')
      .select('id, title, due_at, status, assignee_id, matter_id, matter:matters(title)')
      .eq('org_id', orgId)
      .not('due_at', 'is', null)
      .gte('due_at', from)
      .lt('due_at', to)
      .order('due_at', { ascending: true })
      .limit(50),
    context.db
      .from('invoices')
      .select('id, number, due_at, status, client_id, matter_id, matter:matters(title)')
      .eq('org_id', orgId)
      .not('due_at', 'is', null)
      .gte('due_at', from)
      .lt('due_at', to)
      .in('status', ['unpaid', 'partial'])
      .order('due_at', { ascending: true })
      .limit(50),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  const events = ((eventsRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const matter = pickRelation<{ title: string }>(row.matters as any);
    return {
      id: String(row.id ?? ''),
      kind: 'event' as const,
      title: String(row.title ?? 'موعد'),
      date: toOptionalString(row.start_at),
      start_at: toOptionalString(row.start_at),
      end_at: toOptionalString(row.end_at),
      matter_id: toOptionalString(row.matter_id),
      matter_title: matter?.title ?? null,
      note: toOptionalString(row.description),
      source_label: String(row.all_day ? 'يوم كامل' : 'موعد'),
    } satisfies OfficeCalendarItem;
  });

  const tasks = ((tasksRes.data as Array<Record<string, unknown>> | null) ?? [])
    .filter((row) => (mine ? String(row.assignee_id ?? '') === context.user.id : true))
    .map((row) => {
      const matter = pickRelation<{ title: string }>(row.matter as any);
      return {
        id: String(row.id ?? ''),
        kind: 'task' as const,
        title: `مهمة: ${String(row.title ?? '')}`,
        date: toOptionalString(row.due_at),
        start_at: toOptionalString(row.due_at),
        end_at: null,
        matter_id: toOptionalString(row.matter_id),
        matter_title: matter?.title ?? null,
        note: String(row.status ?? ''),
        source_label: 'مهمة',
      } satisfies OfficeCalendarItem;
    });

  const invoices = ((invoicesRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => {
    const matter = pickRelation<{ title: string }>(row.matter as any);
    return {
      id: String(row.id ?? ''),
      kind: 'invoice' as const,
      title: `فاتورة مستحقة: ${String(row.number ?? '')}`,
      date: toOptionalString(row.due_at),
      start_at: toOptionalString(row.due_at),
      end_at: null,
      matter_id: toOptionalString(row.matter_id),
      matter_title: matter?.title ?? null,
      note: String(row.status ?? ''),
      source_label: 'فاتورة',
    } satisfies OfficeCalendarItem;
  });

  return {
    items: [...events, ...tasks, ...invoices]
      .filter((item) => item.date)
      .sort((a, b) => new Date(a.date ?? '').getTime() - new Date(b.date ?? '').getTime()),
    from,
    to,
  };
}

export async function listOfficeNotifications(
  context: MobileAppSessionContext,
  params: OfficeListParams = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await context.db
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .or(`recipient_user_id.is.null,recipient_user_id.eq.${context.user.id}`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const notifications = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id ?? ''),
    source: toOptionalString(row.source),
    category: toOptionalString(row.category),
    title: String(row.title ?? ''),
    body: toOptionalString(row.body),
    entity_type: toOptionalString(row.entity_type),
    entity_id: toOptionalString(row.entity_id),
    created_at: toOptionalString(row.created_at),
  })) satisfies OfficeNotificationItem[];

  return {
    data: notifications,
    page,
    limit,
    total: count ?? notifications.length,
  };
}

export async function getOfficeOverviewData(context: MobileAppSessionContext) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const now = new Date();
  const upcomingTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const [clientsRes, mattersRes, tasksRes, invoicesRes, documentsRes, quotesRes, calendarRes, notificationsRes] =
    await Promise.all([
      context.db.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      context.db
        .from('matters')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['new', 'in_progress', 'on_hold']),
      context.db
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .neq('status', 'done'),
      context.db
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .neq('status', 'paid'),
      context.db.from('documents').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      context.db.from('quotes').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      listOfficeCalendar(context, { from: nowIso, to: upcomingTo }),
      listOfficeNotifications(context, { page: 1, limit: 10 }),
    ]);

  const [topTasks, topDocuments, topBilling, topNotifications] = await Promise.all([
    listOfficeTasks(context, { page: 1, limit: 5 }).catch(() => ({ data: [], page: 1, limit: 5, total: 0 })),
    listOfficeDocuments(context, { page: 1, limit: 5 }).catch(() => ({ data: [], page: 1, limit: 5, total: 0 })),
    listOfficeBilling(context, { page: 1, limit: 5 }).catch(() => ({
      invoices: { data: [], page: 1, limit: 5, total: 0 },
      quotes: { data: [], page: 1, limit: 5, total: 0 },
    })),
    listOfficeNotifications(context, { page: 1, limit: 5 }).catch(() => ({ data: [], page: 1, limit: 5, total: 0 })),
  ]);

  return {
    user: context.user,
    org: context.org,
    role: {
      name: context.role,
      is_admin: context.isAdmin,
      has_partner_access: context.hasPartnerAccess,
    },
    counts: {
      clients: clientsRes.count ?? 0,
      open_matters: mattersRes.count ?? 0,
      open_tasks: tasksRes.count ?? 0,
      unpaid_invoices: invoicesRes.count ?? 0,
      documents: documentsRes.count ?? 0,
      quotes: quotesRes.count ?? 0,
      upcoming_items: calendarRes.items.length,
      notifications: notificationsRes.total,
    },
    highlights: {
      tasks: topTasks.data,
      documents: topDocuments.data,
      invoices: topBilling.invoices.data,
      quotes: topBilling.quotes.data,
      calendar: calendarRes.items,
      notifications: topNotifications.data,
    },
  };
}
