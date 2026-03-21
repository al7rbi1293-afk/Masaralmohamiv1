import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { getOfficeBillingRecord } from '@/lib/mobile/office-billing-crud';
import { CircuitOpenError, TimeoutError, renderInvoicePdfBuffer } from '@/lib/invoice-pdf';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(request: NextRequest, context: RouteParams) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, org } = auth.context;
  const orgId = org?.id;
  if (!orgId) {
    return NextResponse.json({ error: 'هذا الحساب لا يملك وصولاً إلى المكتب.' }, { status: 403 });
  }
  const params = await Promise.resolve(context.params);

  try {
    const record = await getOfficeBillingRecord(auth.context, params.id);
    if (!record || record.kind !== 'invoice') {
      return NextResponse.json({ error: 'الفاتورة غير متاحة.' }, { status: 404 });
    }

    const invoice = record.invoice;
    const [clientRes, orgRes] = await Promise.all([
      db
        .from('clients')
        .select('name')
        .eq('org_id', orgId)
        .eq('id', invoice.client_id)
        .maybeSingle(),
      db
        .from('organizations')
        .select('name, logo_url, tax_number')
        .eq('id', orgId)
        .maybeSingle(),
    ]);

    const paidAmount = record.payments.reduce((sum, payment) => {
      const value = typeof payment.amount === 'number' ? payment.amount : Number(payment.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const total = Number(invoice.total);
    const safeTotal = Number.isFinite(total) ? total : 0;
    const remaining = Math.max(0, safeTotal - paidAmount);

    let pdfResult: Awaited<ReturnType<typeof renderInvoicePdfBuffer>>;
    try {
      pdfResult = await renderInvoicePdfBuffer({
        number: String(invoice.number ?? ''),
        items: invoice.items,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        currency: String(invoice.currency ?? 'SAR'),
        status: String(invoice.status ?? ''),
        issued_at: String(invoice.issued_at ?? ''),
        due_at: invoice.due_at ? String(invoice.due_at) : null,
        clientName: (clientRes.data as { name?: string | null } | null)?.name ?? null,
        orgName: (orgRes.data as { name?: string | null } | null)?.name ?? null,
        logoUrl: (orgRes.data as { logo_url?: string | null } | null)?.logo_url ?? null,
        paidAmount,
        remaining,
        taxNumber:
          (invoice as { tax_number?: string | null; tax_enabled?: boolean }).tax_number ||
          (orgRes.data as { tax_number?: string | null } | null)?.tax_number ||
          null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('mobile_office_invoice_pdf_transient', { message: error.message });
        return NextResponse.json({ error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' }, { status: 503 });
      }
      throw error;
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: orgId,
      user_id: null,
      action: 'mobile_office_invoice_pdf_export',
      entity_type: 'invoice',
      entity_id: params.id,
      meta: {
        token: auth.context.token,
        number: invoice.number,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('mobile_office_invoice_pdf_exported', {
      orgId,
      invoiceId: params.id,
    });

    return new NextResponse(pdfResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.fileName}"`,
      },
    });
  } catch (error) {
    logError('mobile_office_invoice_pdf_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
      stack: error instanceof Error ? error.stack : null,
      invoiceId: params.id,
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF للفاتورة.' }, { status: 500 });
  }
}
