import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { setOfficeInvoiceArchived } from '@/lib/mobile/office-billing-crud';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const archiveSchema = z.object({
  archived: z.boolean().optional().default(true),
});

type RouteProps = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteProps) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = archiveSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث حالة الفاتورة.' },
        { status: 400 },
      );
    }

    const invoice = await setOfficeInvoiceArchived(auth.context, params.id, parsed.data.archived);
    logInfo(parsed.data.archived ? 'mobile_office_invoice_archived' : 'mobile_office_invoice_restored', {
      invoiceId: invoice.id,
      orgId: auth.context.org?.id ?? null,
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث حالة الفاتورة.');
    logError('mobile_office_invoice_archive_failed', { message });
    return NextResponse.json({ error: message }, { status: toHttpStatus(message) });
  }
}

function toUserMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) return message;
  if (normalized.includes('permission denied') || normalized.includes('violates row-level security')) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }
  if (normalized.includes('archive_not_supported')) return 'التحديث المؤرشف غير مدعوم في هذا المخطط.';
  if (normalized.includes('not_found')) return 'الفاتورة غير موجودة.';
  return message || fallback;
}

function toHttpStatus(message: string) {
  if (message === 'لا تملك صلاحية لهذا الإجراء.') return 403;
  if (message === 'الفاتورة غير موجودة.') return 404;
  return 400;
}

