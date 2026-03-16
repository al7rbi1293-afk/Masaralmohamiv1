import { NextResponse } from 'next/server';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { computeInvoicePaidAmount } from '@/lib/billing';
import { logAudit } from '@/lib/audit';
import { logError, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { generateZatcaQrCode } from '@/lib/zatca';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const invoiceId = context.params.id;
    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        'id, org_id, number, items, subtotal, tax, total, currency, status, tax_number, tax_enabled, issued_at, due_at, client:clients(id, name, address)',
      )
      .eq('org_id', orgId)
      .eq('id', invoiceId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة.' }, { status: 404 });
    }

    const [paidAmount, orgResult] = await Promise.all([
      computeInvoicePaidAmount(invoice.id),
      supabase.from('organizations').select('name, logo_url, address, cr_number').eq('id', orgId).maybeSingle(),
    ]);

    const org = (orgResult as any)?.data;
    const totalNumber = Number(invoice.total);
    const remaining = Math.max(0, (Number.isFinite(totalNumber) ? totalNumber : 0) - paidAmount);

    const clientName = Array.isArray((invoice as any).client)
      ? (invoice as any).client[0]?.name
      : (invoice as any).client?.name;

    const clientAddress = Array.isArray((invoice as any).client)
      ? (invoice as any).client[0]?.address
      : (invoice as any).client?.address;

    let pdfResult: Awaited<ReturnType<typeof renderInvoicePdfBuffer>>;
    try {
      pdfResult = await renderInvoicePdfBuffer({
        number: String(invoice.number ?? ''),
        items: (invoice as any).items,
        subtotal: (invoice as any).subtotal,
        tax: (invoice as any).tax,
        total: (invoice as any).total,
        currency: String(invoice.currency ?? 'SAR'),
        status: String(invoice.status ?? ''),
        issued_at: String(invoice.issued_at ?? ''),
        due_at: invoice.due_at ? String(invoice.due_at) : null,
        clientName: clientName ? String(clientName) : null,
        clientAddress: clientAddress ? String(clientAddress) : null,
        orgName: org?.name ? String(org.name) : null,
        orgAddress: org?.address ? String(org.address) : null,
        logoUrl: org?.logo_url ? String(org.logo_url) : null,
        paidAmount,
        remaining,
        taxNumber: (invoice as any).tax_number ? String((invoice as any).tax_number) : null,
        crNumber: org?.cr_number ? String(org.cr_number) : null,
        qrCode: (invoice as any).tax_enabled && (invoice as any).tax_number ? generateZatcaQrCode({
          sellerName: org?.name ?? 'إدارة المكتب',
          vatNumber: String((invoice as any).tax_number),
          timestamp: String(invoice.issued_at),
          totalAmount: String(invoice.total),
          vatAmount: String(invoice.tax),
        }) : null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('invoice_pdf_export_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw error;
    }

    await logAudit({
      action: 'invoice.pdf_export',
      entityType: 'invoice',
      entityId: invoiceId,
      meta: { number: invoice.number },
      req: request,
    });

    return new NextResponse(pdfResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.fileName}"`,
      },
    });
  } catch (error) {
    logError('invoice_pdf_export_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF.' }, { status: 500 });
  }
}
