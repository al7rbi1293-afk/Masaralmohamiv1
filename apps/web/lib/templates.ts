import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';

export type TemplateStatus = 'active' | 'archived';
export type TemplateType = 'docx';

export type Template = {
  id: string;
  org_id: string;
  name: string;
  category: string;
  template_type: TemplateType;
  description: string | null;
  status: TemplateStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TemplateVariableSource = 'client' | 'matter' | 'org' | 'user' | 'computed' | 'manual';
export type TemplateVariableFormat = 'text' | 'date' | 'number' | 'id';
export type TemplateVariableTransform = 'upper' | 'lower' | 'none';

export type TemplateVersionVariable = {
  key: string;
  label_ar: string;
  required: boolean;
  source: TemplateVariableSource;
  path?: string | null;
  format?: TemplateVariableFormat | null;
  transform?: TemplateVariableTransform | null;
  defaultValue?: string | null;
  help_ar?: string | null;
};

export type TemplateVersion = {
  id: string;
  org_id: string;
  template_id: string;
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  variables: TemplateVersionVariable[];
  uploaded_by: string;
  created_at: string;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export type ListTemplatesParams = {
  q?: string;
  category?: string;
  status?: TemplateStatus | 'all';
  page?: number;
  limit?: number;
};

const TEMPLATE_SELECT =
  'id, org_id, name, category, template_type, description, status, created_by, created_at, updated_at';

export async function listTemplates(params: ListTemplatesParams = {}): Promise<PaginatedResult<Template>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'active';
  const q = cleanQuery(params.q);
  const category = (params.category ?? '').trim();

  let query = supabase
    .from('templates')
    .select(TEMPLATE_SELECT, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.ilike('name', pattern);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data as Template[] | null) ?? [],
    page,
    limit,
    total: count ?? 0,
  };
}

export async function listTemplateCategories(): Promise<string[]> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('templates')
    .select('category')
    .eq('org_id', orgId)
    .order('category', { ascending: true })
    .limit(200);

  if (error) throw error;

  const categories = ((data as Array<{ category: string }> | null) ?? [])
    .map((row) => String(row.category ?? '').trim())
    .filter(Boolean);

  return Array.from(new Set(categories));
}

export async function getTemplateById(id: string): Promise<Template | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('templates')
    .select(TEMPLATE_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as Template | null) ?? null;
}

export type CreateTemplatePayload = {
  name: string;
  category?: string;
  description?: string | null;
};

export async function createTemplate(payload: CreateTemplatePayload): Promise<Template> {
  const orgId = await requireOrgIdForUser();
  const user = await getCurrentAuthUser();
  if (!user) throw new Error('not_authenticated');

  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('templates')
    .insert({
      org_id: orgId,
      name: payload.name,
      category: (payload.category ?? 'عام').trim() || 'عام',
      template_type: 'docx',
      description: payload.description ?? null,
      status: 'active',
      created_by: user.id,
    })
    .select(TEMPLATE_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء القالب.');
  }

  return data as Template;
}

export async function setTemplateStatus(id: string, status: TemplateStatus): Promise<void> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { error } = await supabase
    .from('templates')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', id);

  if (error) throw error;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('template_versions')
    .select(
      'id, org_id, template_id, version_no, storage_path, file_name, file_size, mime_type, variables, uploaded_by, created_at',
    )
    .eq('org_id', orgId)
    .eq('template_id', templateId)
    .order('version_no', { ascending: false });

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => ({
    id: String(row.id),
    org_id: String(row.org_id),
    template_id: String(row.template_id),
    version_no: Number(row.version_no),
    storage_path: String(row.storage_path),
    file_name: String(row.file_name),
    file_size: Number(row.file_size ?? 0),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    variables: Array.isArray(row.variables) ? (row.variables as TemplateVersionVariable[]) : [],
    uploaded_by: String(row.uploaded_by),
    created_at: String(row.created_at),
  }));
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}
