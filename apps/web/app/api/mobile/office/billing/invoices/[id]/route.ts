import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { itemsSchema } from '@/lib/billing';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { deleteOfficeBillingRecord, getOfficeBillingRecord, updateOfficeInvoice } from '@/lib/mobile/office-billing-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const invoiceUpdateSchema = z.object({
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
  status: z.enum(['unpaid', 'partial', 'paid', 'void']).optional(),
});

type RouteProps = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const record = await getOfficeBillingRecord(auth.context, params.id);
    if (!record || record.kind !== 'invoice') {
      return NextResponse.json({ error: 'الفاتورة غير موجودة.' }, { status: 404 });
    }

    return NextResponse.json({ invoice: record.invoice, payments: record.payments });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحميل الفاتورة.');
    logError('mobile_office_invoice_get_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = invoiceUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث الفاتورة.' },
        { status: 400 },
      );
    }

    const invoice = await updateOfficeInvoice(auth.context, params.id, {
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items: parsed.data.items,
      tax: parsed.data.tax,
      tax_enabled: parsed.data.tax_enabled,
      tax_number: emptyToNull(parsed.data.tax_number),
      due_at: emptyToNull(parsed.data.due_at),
      status: parsed.data.status,
    });

    logInfo('mobile_office_invoice_updated', { invoiceId: invoice.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ invoice });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث الفاتورة.');
    logError('mobile_office_invoice_update_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const deleted = await deleteOfficeBillingRecord(auth.context, params.id);
    if (deleted.kind !== 'invoice') {
      return NextResponse.json({ error: 'عرض السعر لا يُحذف من هذا المسار.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر حذف الفاتورة.');
    logError('mobile_office_invoice_delete_failed', { message });
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
  if (normalized.includes('not_found')) return 'الفاتورة غير موجودة.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'العميل غير موجود.' || message === 'القضية غير موجودة.' || message === 'الفاتورة غير موجودة.') {
    return 404;
  }
  return 400;
}

