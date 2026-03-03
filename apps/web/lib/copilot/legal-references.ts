import type { CopilotSource } from './schema';

type SupportedCaseType =
  | 'commercial'
  | 'labor'
  | 'personal_status'
  | 'general'
  | 'criminal'
  | 'administrative'
  | 'enforcement';

type LegalReferenceEntry = {
  id: string;
  title: string;
  referenceCode: string;
  sourceType: 'law' | 'regulation' | 'precedent' | 'practice';
  caseTypes: SupportedCaseType[];
  keywords: string[];
  content: string;
};

const LEGAL_REFERENCE_ENTRIES: LegalReferenceEntry[] = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    title: 'نظام المرافعات الشرعية',
    referenceCode: 'KSA-LAW-PRC-CIVIL',
    sourceType: 'law',
    caseTypes: ['general', 'commercial', 'labor', 'personal_status', 'enforcement'],
    keywords: ['المرافعات', 'صحيفة', 'الدعوى', 'الاختصاص', 'التبليغ', 'الدفوع الشكلية', 'الإجراءات'],
    content:
      'مرجع إجرائي عام للمرافعات: تحقق من الاختصاص النوعي والمكاني، وصفة الأطراف، وصحة صحيفة الدعوى، وترتيب الطلبات والأسانيد والمستندات، وضبط المواعيد والتبليغ والدفوع الشكلية قبل الموضوع.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000002',
    title: 'اللائحة التنفيذية لنظام المرافعات الشرعية',
    referenceCode: 'KSA-REG-PRC-CIVIL',
    sourceType: 'regulation',
    caseTypes: ['general', 'commercial', 'labor', 'personal_status', 'enforcement'],
    keywords: ['اللائحة التنفيذية', 'مرافعات', 'قيد الدعوى', 'التبليغ', 'الطلبات العارضة', 'المهلة'],
    content:
      'مرجع تفصيلي لتطبيق إجراءات المرافعات عمليًا: قيد الدعوى، متطلبات المذكرات، آجال الرد، ضوابط الطلبات العارضة، وإدارة الجلسات وتبادل المستندات.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000003',
    title: 'نظام المحاكم التجارية',
    referenceCode: 'KSA-LAW-COMM-COURTS',
    sourceType: 'law',
    caseTypes: ['commercial', 'enforcement'],
    keywords: ['تجارية', 'محكمة تجارية', 'الأعمال التجارية', 'الإفلاس', 'الشركات', 'العقود التجارية'],
    content:
      'مرجع قضايا المحاكم التجارية: تحديد الطبيعة التجارية للنزاع، الاختصاص، تنظيم الطلبات التجارية، المستندات المحاسبية والتعاقدية، وإدارة الدفوع المرتبطة بالأعمال التجارية.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000004',
    title: 'قواعد وإجراءات المرافعة أمام المحاكم التجارية',
    referenceCode: 'KSA-REG-COMM-PROCEDURE',
    sourceType: 'regulation',
    caseTypes: ['commercial', 'enforcement'],
    keywords: ['إجراءات تجارية', 'المحاكم التجارية', 'الترافع', 'الإثبات التجاري', 'المستندات التجارية'],
    content:
      'مرجع عملي للتقاضي التجاري: إعداد صحيفة دعوى تجارية دقيقة، تسلسل المرافعة، عرض الوقائع المالية، الربط بين البنود التعاقدية والطلبات، ومعالجة الدفوع الإجرائية والموضوعية.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000005',
    title: 'نظام المرافعات أمام ديوان المظالم',
    referenceCode: 'KSA-LAW-BOG-LITIGATION',
    sourceType: 'law',
    caseTypes: ['administrative'],
    keywords: ['ديوان المظالم', 'إدارية', 'قرار إداري', 'مشروعية', 'إلغاء قرار', 'تعويض إداري'],
    content:
      'مرجع الدعوى الإدارية: فحص القرار الإداري محل الطعن، شرط المصلحة والاختصاص، أسباب عدم المشروعية، طلبات الإلغاء أو التعويض، وتسلسل الإثبات في منازعات الجهات الإدارية.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000006',
    title: 'نظام الإجراءات الجزائية',
    referenceCode: 'KSA-LAW-CRIM-PROCEDURE',
    sourceType: 'law',
    caseTypes: ['criminal'],
    keywords: ['جزائية', 'إجراءات جزائية', 'التحقيق', 'الاستجواب', 'الضبط', 'البطلان', 'الدليل الجنائي'],
    content:
      'مرجع القضايا الجزائية: ضمانات التحقيق والمحاكمة، مشروعية إجراءات الضبط والاستجواب، تقييم سلامة الدليل، الدفع بالبطلان الإجرائي، وتدرج الطلبات الدفاعية بحسب مرحلة الدعوى.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000007',
    title: 'نظام الأحوال الشخصية',
    referenceCode: 'KSA-LAW-PERSONAL-STATUS',
    sourceType: 'law',
    caseTypes: ['personal_status'],
    keywords: ['أحوال شخصية', 'نفقة', 'حضانة', 'زيارة', 'طلاق', 'خلع', 'إثبات نسب', 'ولاية'],
    content:
      'مرجع قضايا الأحوال الشخصية: ضبط الوقائع الأسرية زمنيًا، تحديد الطلبات النظامية (نفقة، حضانة، زيارة، إثبات)، تقدير الأدلة المقبولة، وصياغة المذكرات بلغة مهنية متوازنة.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000008',
    title: 'نظام التنفيذ',
    referenceCode: 'KSA-LAW-ENFORCEMENT',
    sourceType: 'law',
    caseTypes: ['enforcement', 'commercial', 'general'],
    keywords: ['تنفيذ', 'سند تنفيذي', 'أمر تنفيذ', 'إيقاف خدمات', 'حجز', 'تحصيل'],
    content:
      'مرجع إجراءات التنفيذ: تحقق من قابلية السند للتنفيذ، تحديد الطلب التنفيذي المناسب، متابعة إجراءات الحجز والتحصيل، والرد على منازعات التنفيذ الشكلية والموضوعية.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000009',
    title: 'مبادئ قضائية وسوابق: منهجية الاستدلال',
    referenceCode: 'KSA-PRECEDENT-METHODOLOGY',
    sourceType: 'precedent',
    caseTypes: ['commercial', 'labor', 'personal_status', 'general', 'criminal', 'administrative', 'enforcement'],
    keywords: ['سابقة', 'سوابق', 'مبدأ قضائي', 'مبادئ قضائية', 'اتجاه قضائي', 'قضاء'],
    content:
      'مرجع منهجي: استخدم السوابق والمبادئ القضائية كدعم استدلالي منضبط، مع بيان أوجه التشابه والاختلاف بين الواقعة الحالية والسابقة، دون تعميم نتيجة سابقة على واقعة مختلفة بلا تعليل.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000010',
    title: 'مهارات تحرير صحيفة الدعوى',
    referenceCode: 'KSA-PRACTICE-CLAIM-DRAFTING',
    sourceType: 'practice',
    caseTypes: ['commercial', 'labor', 'personal_status', 'general', 'criminal', 'administrative', 'enforcement'],
    keywords: ['تحرير الدعوى', 'صياغة صحيفة', 'وقائع', 'طلبات', 'أسانيد', 'صياغة قانونية'],
    content:
      'مرجع مهني لتحرير الدعوى: ابدأ بوقائع مرتبة زمنيًا، ثم التكييف النظامي، ثم الأسانيد، ثم الطلبات بصيغة قابلة للحكم، مع تجنب العبارات الإنشائية غير المؤثرة قانونيًا.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000011',
    title: 'فنون الرد والمذكرة الجوابية',
    referenceCode: 'KSA-PRACTICE-RESPONSE',
    sourceType: 'practice',
    caseTypes: ['commercial', 'labor', 'personal_status', 'general', 'criminal', 'administrative', 'enforcement'],
    keywords: ['مذكرة جوابية', 'الرد', 'دفوع', 'دفع شكلي', 'دفع موضوعي', 'تفنيد'],
    content:
      'مرجع الرد القانوني: عالج كل دفع على حدة، فرّق بين الشكل والموضوع، اربط كل رد بمستند أو واقعة ثابتة، واطلب صراحةً الأثر الإجرائي أو الموضوعي المطلوب من المحكمة.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000012',
    title: 'فنون الإقناع والمرافعة',
    referenceCode: 'KSA-PRACTICE-PERSUASION',
    sourceType: 'practice',
    caseTypes: ['commercial', 'labor', 'personal_status', 'general', 'criminal', 'administrative', 'enforcement'],
    keywords: ['الإقناع', 'المرافعة', 'المرافعة الشفهية', 'المنطق القانوني', 'ترتيب الحجة'],
    content:
      'مرجع الإقناع المهني: ابنِ الحجة على بنية واضحة (واقعة، قاعدة، تطبيق، نتيجة)، وتجنب الجزم غير المسند، وقدّم بدائل طلبات أصلية واحتياطية مع تسبيب موجز قوي.',
  },
  {
    id: 'a1000000-0000-0000-0000-000000000013',
    title: 'نظام الإثبات (ضبط الأدلة)',
    referenceCode: 'KSA-LAW-EVIDENCE',
    sourceType: 'law',
    caseTypes: ['commercial', 'labor', 'personal_status', 'general', 'criminal', 'administrative', 'enforcement'],
    keywords: ['الإثبات', 'الدليل', 'القرائن', 'البينة', 'الكتابة', 'شهادة', 'خبرة'],
    content:
      'مرجع الأدلة: حدد لكل واقعة دليلها الأنسب، وقيّم الحجية والقبول الإجرائي، وبيّن العلاقة السببية بين الدليل والنتيجة المطلوبة قبل بناء الطلبات النهائية.',
  },
];

const DEFAULT_REFERENCE_IDS = [
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000013',
];

export function selectBuiltInLegalReferences(params: {
  query: string;
  caseType?: string | null;
  limit?: number;
}): CopilotSource[] {
  const normalizedQuery = normalizeArabic(params.query);
  const caseType = normalizeCaseType(params.caseType);
  const limit = Math.max(1, Math.min(params.limit ?? 6, 12));

  const scored = LEGAL_REFERENCE_ENTRIES.map((entry) => {
    const score = scoreReference(entry, normalizedQuery, caseType);
    return { entry, score };
  })
    .filter((item) => item.score >= 0.62)
    .sort((a, b) => b.score - a.score);

  const selected = new Map<string, { entry: LegalReferenceEntry; score: number }>();
  for (const item of scored) {
    if (selected.size >= limit) break;
    selected.set(item.entry.id, item);
  }

  if (selected.size < limit) {
    for (const id of DEFAULT_REFERENCE_IDS) {
      if (selected.size >= limit) break;
      const entry = LEGAL_REFERENCE_ENTRIES.find((item) => item.id === id);
      if (!entry || selected.has(id)) continue;
      selected.set(id, { entry, score: 0.64 });
    }
  }

  return Array.from(selected.values())
    .sort((a, b) => b.score - a.score)
    .map(({ entry, score }) => ({
      chunkId: entry.id,
      label: `${entry.title} (${entry.referenceCode})`,
      content: entry.content,
      pageNo: null,
      similarity: score,
      pool: 'kb' as const,
    }));
}

function scoreReference(
  entry: LegalReferenceEntry,
  normalizedQuery: string,
  caseType: SupportedCaseType | null,
): number {
  const normalizedTitle = normalizeArabic(entry.title);
  const caseTypeMatch = caseType ? entry.caseTypes.includes(caseType) : false;
  let score = 0.5 + (caseTypeMatch ? 0.18 : 0);

  if (normalizedQuery.includes(normalizedTitle)) {
    score += 0.2;
  }

  let keywordHits = 0;
  for (const keyword of entry.keywords) {
    if (normalizedQuery.includes(normalizeArabic(keyword))) {
      keywordHits += 1;
    }
  }

  score += Math.min(0.24, keywordHits * 0.06);

  // Always keep practice references slightly available for drafting/reply prompts.
  if (entry.sourceType === 'practice' && /مذكر|صياغ|دعو|رد|اقناع|مرافع/.test(normalizedQuery)) {
    score += 0.12;
  }

  return Math.min(0.98, score);
}

function normalizeCaseType(caseType: string | null | undefined): SupportedCaseType | null {
  const value = String(caseType ?? '').trim().toLowerCase();
  if (
    value === 'commercial' ||
    value === 'labor' ||
    value === 'personal_status' ||
    value === 'general' ||
    value === 'criminal' ||
    value === 'administrative' ||
    value === 'enforcement'
  ) {
    return value;
  }
  return null;
}

function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

