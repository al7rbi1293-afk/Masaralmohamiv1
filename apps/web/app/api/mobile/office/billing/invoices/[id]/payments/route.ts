import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { addOfficeInvoicePayment, listOfficeInvoicePayments } from '@/lib/mobile/office-billing-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const paymentCreateSchema = z.object({
  amount: z.number().positive('قيمة الدفعة يجب أن تكون أكبر من 0.'),
  method: z.string().trim().max(80, 'طريقة الدفع طويلة جدًا.').optional().or(z.literal('')).nullable(),
  paid_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'تاريخ السداد غير صحيح.',
    }),
  note: z.string().trim().max(500, 'الملاحظة طويلة جدًا.').optional().or(z.literal('')).nullable(),
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
    const payments = await listOfficeInvoicePayments(auth.context, params.id);
    return NextResponse.json({ payments });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحميل الدفعات.');
    logError('mobile_office_invoice_payments_get_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = paymentCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تسجيل الدفعة.' },
        { status: 400 },
      );
    }

    const result = await addOfficeInvoicePayment(auth.context, params.id, {
      amount: parsed.data.amount,
      method: emptyToNull(parsed.data.method),
      paid_at: emptyToNull(parsed.data.paid_at),
      note: emptyToNull(parsed.data.note),
    });

    logInfo('mobile_office_invoice_payment_added', {
      invoiceId: result.invoice.id,
      paymentId: result.payment.id,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تسجيل الدفعة.');
    logError('mobile_office_invoice_payment_create_failed', { message });
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
  if (normalized.includes('not_found')) return 'الفاتورة غير موجودة.';
  if (normalized.includes('قيمة الدفعة غير صحيحة')) return 'قيمة الدفعة غير صحيحة.';
  if (normalized.includes('لا يمكن تسجيل دفعات لفاتورة ملغاة')) return 'لا يمكن تسجيل دفعات لفاتورة ملغاة.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'الفاتورة غير موجودة.') return 404;
  return 400;
}

