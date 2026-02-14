import 'server-only';

import presets from '@/seed/template_presets.json';

export type TemplateVariableSource = 'org' | 'client' | 'matter' | 'user' | 'computed' | 'manual';
export type TemplateVariableFormat = 'text' | 'date' | 'number' | 'id';
export type TemplateVariableTransform = 'none' | 'upper' | 'lower';

export type TemplateVariable = {
  key: string;
  label_ar: string;
  required: boolean;
  source: TemplateVariableSource;
  path?: string;
  defaultValue?: string;
  format: TemplateVariableFormat;
  transform: TemplateVariableTransform;
  help_ar: string;
};

export type TemplatePreset = {
  code: string;
  name_ar: string;
  category: string;
  variables: TemplateVariable[];
};

// TODO: Future: migrate presets to DB table `template_presets` and add admin import.
export const TEMPLATE_PRESETS = presets as TemplatePreset[];

