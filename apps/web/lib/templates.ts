export type TemplateVariableSource = 'client' | 'matter' | 'org' | 'user' | 'computed' | 'manual';

export type TemplateVariableFormat = 'text' | 'date' | 'number' | 'id';

export type TemplateVariableTransform = 'none' | 'upper' | 'lower';

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
