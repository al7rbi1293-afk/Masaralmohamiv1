export type InvoiceEmailTemplateData = {
  invoiceNumber: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  total?: number | string | null;
  currency?: string | null;
  clientName?: string | null;
  officeName?: string | null;
};

type SubjectData = Pick<InvoiceEmailTemplateData, 'invoiceNumber' | 'dueAt'>;

export function buildInvoiceEmailSubject(data: SubjectData) {
  const number = data.invoiceNumber.trim();
  const dueDate = formatDateYmd(data.dueAt);
  if (!dueDate) return `فاتورة رقم ${number} - مسار المحامي`;
  return `فاتورة رقم ${number} - يرجى السداد قبل ${dueDate}`;
}

export function buildInvoiceEmailMessage(data: InvoiceEmailTemplateData) {
  const number = data.invoiceNumber.trim();
  const issuedDate = formatDateAr(data.issuedAt) ?? '—';
  const dueDate = formatDateAr(data.dueAt);
  const amount = formatAmount(data.total, data.currency);
  const recipient = data.clientName?.trim()
    ? `الأستاذ/ة ${data.clientName.trim()} المحترم/ة،`
    : 'عميلنا الكريم،';
  const officeName = data.officeName?.trim() || 'إدارة المكتب';
  const dueSentence = dueDate
    ? `نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن، وبحد أقصى قبل تاريخ الاستحقاق ${dueDate}.`
    : 'نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن.';

  return [
    'السلام عليكم ورحمة الله وبركاته،',
    recipient,
    '',
    `نرفق لكم فاتورة رقم ${number} بتاريخ ${issuedDate} بقيمة إجمالية ${amount}.`,
    '',
    dueSentence,
    '',
    'في حال تم السداد مسبقًا، نأمل تجاهل هذه الرسالة.',
    'ولأي استفسار، يسعدنا تواصلكم معنا.',
    '',
    'وتفضلوا بقبول فائق الاحترام والتقدير،',
    officeName,
  ].join('\n');
}

function formatDateAr(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ar-SA');
}

function formatDateYmd(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function formatAmount(value: number | string | null | undefined, currency?: string | null) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  const currencyCode = (currency || 'SAR').trim() || 'SAR';
  const amount = safeNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount} ${currencyCode}`;
}
