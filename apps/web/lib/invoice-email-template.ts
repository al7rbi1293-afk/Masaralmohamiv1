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
  const number = data.invoiceNumber.trim() || 'بدون رقم';
  const dueDate = formatDateYmd(data.dueAt);
  if (!dueDate) return `فاتورة رقم (${number}) - مسار المحامي`;
  return `فاتورة رقم (${number}) - يرجى السداد قبل (${dueDate})`;
}

export function buildInvoiceEmailMessage(data: InvoiceEmailTemplateData) {
  const number = data.invoiceNumber.trim() || 'بدون رقم';
  const issuedDate = formatDateYmd(data.issuedAt) ?? 'غير محدد';
  const dueDate = formatDateYmd(data.dueAt);
  const amount = formatAmount(data.total, data.currency);
  const recipient = data.clientName?.trim()
    ? `الأستاذ/ة ${data.clientName.trim()} المحترم/ة،`
    : 'عميلنا الكريم،';
  const officeName = data.officeName?.trim() || 'إدارة المكتب';
  const dueValue = dueDate ?? 'غير محدد';
  const dueSentence = dueDate
    ? `نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن، وبحد أقصى قبل تاريخ الاستحقاق ${dueDate}.`
    : 'نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن.';

  return [
    'السلام عليكم ورحمة الله وبركاته،',
    recipient,
    '',
    'نرفق لكم الفاتورة، وفيما يلي بياناتها:',
    '',
    `- رقم الفاتورة: ${number}`,
    `- تاريخ الإصدار: ${issuedDate}`,
    `- تاريخ الاستحقاق: ${dueValue}`,
    `- المبلغ المستحق: ${amount}`,
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

export function buildInvoiceEmailHtml(data: InvoiceEmailTemplateData) {
  const number = data.invoiceNumber.trim() || 'بدون رقم';
  const issuedDate = formatDateYmd(data.issuedAt) ?? 'غير محدد';
  const dueDate = formatDateYmd(data.dueAt);
  const amount = formatAmount(data.total, data.currency);
  const recipient = data.clientName?.trim()
    ? `الأستاذ/ة ${data.clientName.trim()} المحترم/ة،`
    : 'عميلنا الكريم،';
  const officeName = data.officeName?.trim() || 'إدارة المكتب';
  const dueValue = dueDate ?? 'غير محدد';
  const dueSentence = dueDate
    ? `نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن، وبحد أقصى قبل تاريخ الاستحقاق ${dueDate}.`
    : 'نأمل التكرم بسداد قيمة الفاتورة في أقرب وقت ممكن.';

  return `
<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:'Tahoma','Arial',sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 12px;">السلام عليكم ورحمة الله وبركاته،</p>
      <p style="margin:0 0 16px;">${escapeHtml(recipient)}</p>
      <p style="margin:0 0 16px;">نرفق لكم الفاتورة، وفيما يلي بياناتها:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">رقم الفاتورة</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;"><bdi dir="ltr">${escapeHtml(number)}</bdi></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">تاريخ الإصدار</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;"><bdi dir="ltr">${escapeHtml(issuedDate)}</bdi></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">تاريخ الاستحقاق</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;"><bdi dir="ltr">${escapeHtml(dueValue)}</bdi></td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">المبلغ المستحق</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;"><bdi dir="ltr">${escapeHtml(amount)}</bdi></td>
        </tr>
      </table>

      <p style="margin:0 0 16px;padding:12px;border:1px solid #fed7aa;background:#fff7ed;border-radius:8px;color:#9a3412;">
        ${escapeHtml(dueSentence)}
      </p>
      <p style="margin:0 0 8px;">في حال تم السداد مسبقًا، نأمل تجاهل هذه الرسالة.</p>
      <p style="margin:0 0 16px;">ولأي استفسار، يسعدنا تواصلكم معنا.</p>
      <p style="margin:0;">وتفضلوا بقبول فائق الاحترام والتقدير،</p>
      <p style="margin:6px 0 0;font-weight:700;">${escapeHtml(officeName)}</p>
    </div>
  </body>
</html>
  `.trim();
}

export function buildRtlEmailHtmlFromText(message: string) {
  const normalized = message.replaceAll('\r\n', '\n').trim();
  const lines = normalized.split('\n');
  const body = lines
    .map((line) => {
      if (!line.trim()) return '<div style="height:10px;"></div>';
      return `<p style="margin:0 0 10px;">${escapeHtml(line)}</p>`;
    })
    .join('');

  return `
<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:'Tahoma','Arial',sans-serif;color:#0f172a;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      ${body}
    </div>
  </body>
</html>
  `.trim();
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
