'use client';

export type DraftTemplateVariable = {
  key: string;
  label_ar: string;
  required: boolean;
  source: 'client' | 'matter' | 'manual';
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
    (value.source === 'client' || value.source === 'matter' || value.source === 'manual')
  );
}

function normalizeVariable(value: DraftTemplateVariable): DraftTemplateVariable {
  return {
    key: String(value.key || '').trim(),
    label_ar: String(value.label_ar || '').trim(),
    required: Boolean(value.required),
    source: value.source,
  };
}
