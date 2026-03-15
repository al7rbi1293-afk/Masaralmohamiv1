import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';
import { CircuitOpenError, TimeoutError, renderInvoicePdfBuffer } from '@/lib/invoice-pdf';

export const runtime = 'nodejs';

type InvoiceRow = {
  id: string;
  number: string;
  items: unknown;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  currency: string | null;
  status: string;
  issued_at: string;
  due_at: string | null;
};

type PaymentRow = {
  amount: string | number;
};

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const access = await getActiveClientPortalAccess();
  if (!access) {
    return NextResponse.json(
      { error: 'انتهت جلسة بوابة العميل. يرجى تسجيل الدخول مرة أخرى.' },
      { status: 401 },
    );
  }

  const { db, session } = access;
  const invoiceId = context.params.id;

  try {
    const { data: invoice, error: invoiceError } = await db
      .from('invoices')
      .select('id, number, items, subtotal, tax, total, currency, status, tax_number, issued_at, due_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) {
      logError('client_portal_invoice_pdf_invoice_lookup_failed', { message: invoiceError.message });
      return NextResponse.json({ error: 'تعذر تجهيز ملف الفاتورة.' }, { status: 400 });
    }

    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير متاحة.' }, { status: 404 });
    }

    const invoiceRow = invoice as InvoiceRow;

    const [{ data: client }, { data: org }, { data: payments }] = await Promise.all([
      db
        .from('clients')
        .select('name')
        .eq('org_id', session.orgId)
        .eq('id', session.clientId)
        .maybeSingle(),
      db
        .from('organizations')
        .select('name, logo_url')
        .eq('id', session.orgId)
        .maybeSingle(),
      db
        .from('payments')
        .select('amount')
        .eq('org_id', session.orgId)
        .eq('invoice_id', invoiceId),
    ]);

    const paidAmount = ((payments as PaymentRow[] | null) ?? []).reduce((sum, row) => {
      const value = typeof row.amount === 'number' ? row.amount : Number(row.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const total = Number(invoiceRow.total);
    const safeTotal = Number.isFinite(total) ? total : 0;
    const remaining = Math.max(0, safeTotal - paidAmount);

    let pdfResult: Awaited<ReturnType<typeof renderInvoicePdfBuffer>>;
    try {
      pdfResult = await renderInvoicePdfBuffer({
        number: String(invoiceRow.number ?? ''),
        items: invoiceRow.items,
        subtotal: invoiceRow.subtotal,
        tax: invoiceRow.tax,
        total: invoiceRow.total,
        currency: String(invoiceRow.currency ?? 'SAR'),
        status: String(invoiceRow.status ?? ''),
        issued_at: String(invoiceRow.issued_at ?? ''),
        due_at: invoiceRow.due_at ? String(invoiceRow.due_at) : null,
        clientName: client?.name ? String(client.name) : null,
        orgName: org?.name ? String(org.name) : null,
        logoUrl: org?.logo_url ? String(org.logo_url) : null,
        paidAmount,
        remaining,
        taxNumber: (invoiceRow as any).tax_number ? String((invoiceRow as any).tax_number) : null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('client_portal_invoice_pdf_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw error;
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: session.orgId,
      user_id: null,
      action: 'client_portal_invoice_pdf_export',
      entity_type: 'invoice',
      entity_id: invoiceId,
      meta: {
        portal_user_id: session.portalUserId,
        number: invoiceRow.number,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('client_portal_invoice_pdf_exported', {
      orgId: session.orgId,
      clientId: session.clientId,
      invoiceId,
    });

    return new NextResponse(pdfResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.fileName}"`,
      },
    });
  } catch (error) {
    logError('client_portal_invoice_pdf_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
      invoiceId,
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF للفاتورة.' }, { status: 500 });
  }
}
