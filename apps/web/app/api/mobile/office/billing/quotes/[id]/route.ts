import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { itemsSchema } from '@/lib/billing';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { deleteOfficeBillingRecord, getOfficeBillingRecord, updateOfficeQuote } from '@/lib/mobile/office-billing-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const quoteUpdateSchema = z.object({
  client_id: z.string().uuid('العميل غير صحيح.'),
  matter_id: z.union([z.string().uuid('القضية غير صحيحة.'), z.literal(''), z.null()]).optional(),
  items: itemsSchema,
  tax: z.number().optional(),
  tax_enabled: z.boolean().optional(),
  tax_number: z.string().trim().max(80, 'الرقم الضريبي طويل جدًا.').optional().or(z.literal('')).nullable(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
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
    if (!record || record.kind !== 'quote') {
      return NextResponse.json({ error: 'عرض السعر غير موجود.' }, { status: 404 });
    }

    return NextResponse.json({ quote: record.quote });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحميل عرض السعر.');
    logError('mobile_office_quote_get_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = quoteUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث عرض السعر.' },
        { status: 400 },
      );
    }

    const quote = await updateOfficeQuote(auth.context, params.id, {
      client_id: parsed.data.client_id,
      matter_id: emptyToNull(parsed.data.matter_id),
      items: parsed.data.items,
      tax: parsed.data.tax,
      tax_enabled: parsed.data.tax_enabled,
      tax_number: emptyToNull(parsed.data.tax_number),
      status: parsed.data.status,
    });

    logInfo('mobile_office_quote_updated', { quoteId: quote.id, orgId: auth.context.org?.id ?? null });
    return NextResponse.json({ quote });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث عرض السعر.');
    logError('mobile_office_quote_update_failed', { message });
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
    if (deleted.kind !== 'quote') {
      return NextResponse.json({ error: 'الفاتورة لا تُحذف من هذا المسار.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر حذف عرض السعر.');
    logError('mobile_office_quote_delete_failed', { message });
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
  if (normalized.includes('not_found')) return 'عرض السعر غير موجود.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'العميل غير موجود.' || message === 'القضية غير موجودة.' || message === 'عرض السعر غير موجود.') {
    return 404;
  }
  return 400;
}

