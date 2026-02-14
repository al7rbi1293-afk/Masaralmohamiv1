export type TemplateVariableSource = 'client' | 'matter' | 'manual';

export type TemplateVariableDefinition = {
  key: string;
  label_ar: string;
  required: boolean;
  source: TemplateVariableSource;
};

export type TemplatePresetId = 'wakala' | 'claim' | 'memo' | 'notice';

export type TemplatePreset = {
  id: TemplatePresetId;
  name_ar: string;
  category: string;
  template_type: 'docx';
  variables: TemplateVariableDefinition[];
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'wakala',
    name_ar: 'وكالة (أساسي)',
    category: 'وكالة',
    template_type: 'docx',
    variables: [
      { key: 'client.name', label_ar: 'اسم الموكل', required: true, source: 'client' },
      { key: 'client.identity_no', label_ar: 'رقم الهوية', required: false, source: 'client' },
      { key: 'manual.agent_name', label_ar: 'اسم الوكيل', required: true, source: 'manual' },
      { key: 'manual.subject', label_ar: 'موضوع الوكالة', required: true, source: 'manual' },
      { key: 'manual.notes', label_ar: 'ملاحظات إضافية', required: false, source: 'manual' },
    ],
  },
  {
    id: 'claim',
    name_ar: 'لائحة دعوى (مختصر)',
    category: 'لائحة دعوى',
    template_type: 'docx',
    variables: [
      { key: 'client.name', label_ar: 'اسم المدعي', required: true, source: 'client' },
      { key: 'client.identity_no', label_ar: 'رقم الهوية', required: false, source: 'client' },
      { key: 'matter.title', label_ar: 'عنوان الدعوى', required: true, source: 'matter' },
      { key: 'matter.summary', label_ar: 'ملخص الدعوى', required: false, source: 'matter' },
      { key: 'manual.claim_amount', label_ar: 'مبلغ المطالبة', required: true, source: 'manual' },
      { key: 'manual.requests', label_ar: 'الطلبات', required: true, source: 'manual' },
    ],
  },
  {
    id: 'memo',
    name_ar: 'مذكرة (عام)',
    category: 'مذكرة',
    template_type: 'docx',
    variables: [
      { key: 'client.name', label_ar: 'اسم الموكل', required: false, source: 'client' },
      { key: 'matter.title', label_ar: 'اسم/عنوان القضية', required: false, source: 'matter' },
      { key: 'manual.subject', label_ar: 'موضوع المذكرة', required: true, source: 'manual' },
      { key: 'manual.body', label_ar: 'نص المذكرة', required: true, source: 'manual' },
    ],
  },
  {
    id: 'notice',
    name_ar: 'إنذار (أساسي)',
    category: 'إنذار',
    template_type: 'docx',
    variables: [
      { key: 'client.name', label_ar: 'اسم المرسل', required: true, source: 'client' },
      { key: 'manual.recipient_name', label_ar: 'اسم المستلم', required: true, source: 'manual' },
      { key: 'manual.subject', label_ar: 'موضوع الإنذار', required: true, source: 'manual' },
      { key: 'manual.body', label_ar: 'نص الإنذار', required: true, source: 'manual' },
    ],
  },
];

export function getTemplatePreset(id: string | null | undefined): TemplatePreset | null {
  const normalized = String(id || '').trim();
  if (!normalized) return null;
  return TEMPLATE_PRESETS.find((preset) => preset.id === normalized) ?? null;
}

