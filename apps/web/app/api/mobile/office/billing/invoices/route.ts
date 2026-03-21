import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { itemsSchema } from '@/lib/billing';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { createOfficeInvoice } from '@/lib/mobile/office-billing-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const invoiceCreateSchema = z.object({
  client_id: z.string().uuid('العميل غير صحيح.'),
  matter_id: z.union([z.string().uuid('القضية غير صحيحة.'), z.literal(''), z.null()]).optional(),
  items: itemsSchema,
  tax: z.number().optional(),
  tax_enabled: z.boolean().optional(),
  tax_number: z.string().trim().max(80, 'الرقم الضريبي طويل جدًا.').optional().or(z.literal('')).nullable(),
  due_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'تاريخ الاستحقاق غير صحيح.',
    }),
});

export async function POST(request: NextRequest) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = invoiceCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء الفاتورة.' },
        { status: 400 },
      );
    }

    const invoice = await createOfficeInvoice(auth.context, {
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items: parsed.data.items,
      tax: parsed.data.tax,
      tax_enabled: parsed.data.tax_enabled,
      tax_number: emptyToNull(parsed.data.tax_number),
      due_at: emptyToNull(parsed.data.due_at),
    });

    logInfo('mobile_office_invoice_created', { invoiceId: invoice.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر إنشاء الفاتورة.');
    logError('mobile_office_invoice_create_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

function emptyToNull(value?: string | null) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function toUserMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;
  if (normalized.includes('permission denied') || normalized.includes('violates row-level security')) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }
  if (normalized.includes('client_not_found')) return 'العميل غير موجود.';
  if (normalized.includes('matter_not_found')) return 'القضية غير موجودة.';
  if (normalized.includes('not_authenticated')) return 'يرجى تسجيل الدخول.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'العميل غير موجود.' || message === 'القضية غير موجودة.') return 404;
  return 400;
}

