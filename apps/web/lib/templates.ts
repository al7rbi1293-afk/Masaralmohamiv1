import 'server-only';

import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

export type TemplateVariableSource = 'client' | 'matter' | 'org' | 'user' | 'computed' | 'manual';

export type TemplateVariableFormat = 'text' | 'date' | 'number' | 'id';

export type TemplateVariableTransform = 'none' | 'upper' | 'lower';

export type TemplateType = 'docx';
export type TemplateStatus = 'active' | 'archived';

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
  template_id: string;
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  variables: TemplateVersionVariable[];
  created_at: string;
};

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

export type ListTemplatesParams = {
  q?: string;
  category?: string;
  status?: TemplateStatus | 'all';
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export async function listTemplates(params: ListTemplatesParams = {}): Promise<PaginatedResult<Template>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'active';
  const q = cleanQuery(params.q);
  const category = cleanCategory(params.category);

  let query = supabase
    .from('templates')
    .select(
      'id, org_id, name, category, template_type, description, status, created_by, created_at, updated_at',
      { count: 'exact' },
    )
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
    query = query.or(`name.ilike.${pattern},category.ilike.${pattern},description.ilike.${pattern}`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: ((data as Template[] | null) ?? []).map((template) => ({
      ...template,
      template_type: 'docx',
    })),
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
    .order('category', { ascending: true });

  if (error) {
    throw error;
  }

  const categories = new Set<string>();
  for (const row of data ?? []) {
    const value = typeof row.category === 'string' ? row.category.trim() : '';
    if (value) {
      categories.add(value);
    }
  }

  return Array.from(categories);
}

export async function setTemplateStatus(id: string, status: TemplateStatus): Promise<void> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('templates')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}

function cleanCategory(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 80);
}
