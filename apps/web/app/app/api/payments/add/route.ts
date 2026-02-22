import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addPayment } from '@/lib/billing';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const addPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive('يرجى إدخال مبلغ صحيح.'),
  method: z.string().trim().max(80).optional().nullable(),
  paid_at: z.string().trim().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = addPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تسجيل الدفعة.' },
        { status: 400 },
      );
    }

    const result = await addPayment(parsed.data.invoice_id, {
      amount: parsed.data.amount,
      method: parsed.data.method ?? null,
      paid_at: parsed.data.paid_at ?? null,
      note: parsed.data.note ?? null,
    });

    await logAudit({
      action: 'payment.added',
      entityType: 'invoice',
      entityId: parsed.data.invoice_id,
      meta: { amount: parsed.data.amount },
      req: request,
    });

    logInfo('payment_added', { invoiceId: parsed.data.invoice_id, amount: parsed.data.amount });
    return NextResponse.json(
      {
        payment: result.payment,
        invoice: result.invoice,
        paidAmount: result.paidAmount,
      },
      { status: 201 },
    );
  } catch (error: any) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const supabaseCode = error?.code ?? '';
    const supabaseDetails = error?.details ?? '';
    const supabaseHint = error?.hint ?? '';
    const message = toUserMessage(error);
    logError('payment_add_failed', {
      message: rawMessage,
      code: supabaseCode,
      details: supabaseDetails,
      hint: supabaseHint,
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Include diagnostic info in the error response
    const debugInfo = supabaseCode ? ` [${supabaseCode}]` : '';
    return NextResponse.json(
      { error: `${message}${debugInfo}` },
      { status: message === 'لا تملك صلاحية لهذا الإجراء.' ? 403 : 400 },
    );
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;
  if (message.includes('قيمة الدفعة غير صحيحة')) return message;
  if (message.includes('لا يمكن تسجيل دفعات')) return message;

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  if (normalized.includes('not_found') || normalized.includes('no rows')) {
    return 'الفاتورة غير موجودة.';
  }

  // Pass through native Supabase/PG error for debugging
  return message || 'تعذر تسجيل الدفعة.';
}

