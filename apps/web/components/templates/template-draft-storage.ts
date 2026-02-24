'use client';

export type DraftTemplateVariable = {
  key: string;
  label_ar: string;
  required: boolean;
  source: 'client' | 'matter' | 'org' | 'user' | 'computed' | 'manual';
  path?: string;
  format?: 'text' | 'date' | 'number' | 'id';
  transform?: 'upper' | 'lower' | 'none';
  defaultValue?: string;
  help_ar?: string;
};

const KEY_PREFIX = 'masar_tpl_vars:';

export function loadDraftVariables(templateId: string): DraftTemplateVariable[] {
  if (typeof window === 'undefined') return [];
  const key = `${KEY_PREFIX}${templateId}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isVariable).map(normalizeVariable);
  } catch {
    return [];
  }
}

export function saveDraftVariables(templateId: string, variables: DraftTemplateVariable[]) {
  if (typeof window === 'undefined') return;
  const key = `${KEY_PREFIX}${templateId}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(variables));
  } catch {
    // ignore
  }
}

export function clearDraftVariables(templateId: string) {
  if (typeof window === 'undefined') return;
  const key = `${KEY_PREFIX}${templateId}`;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function isVariable(value: any): value is DraftTemplateVariable {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.key === 'string' &&
    typeof value.label_ar === 'string' &&
    typeof value.required === 'boolean' &&
    (value.source === 'client' ||
      value.source === 'matter' ||
      value.source === 'org' ||
      value.source === 'user' ||
      value.source === 'computed' ||
      value.source === 'manual')
  );
}

function normalizeVariable(value: DraftTemplateVariable): DraftTemplateVariable {
  return {
    key: String(value.key || '').trim(),
    label_ar: String(value.label_ar || '').trim(),
    required: Boolean(value.required),
    source: value.source,
    path: typeof value.path === 'string' ? value.path.trim() : '',
    format: value.format === 'date' || value.format === 'number' || value.format === 'id' ? value.format : 'text',
    transform: value.transform === 'upper' || value.transform === 'lower' ? value.transform : 'none',
    defaultValue: typeof value.defaultValue === 'string' ? value.defaultValue.trim() : '',
    help_ar: typeof value.help_ar === 'string' ? value.help_ar.trim() : '',
  };
}
