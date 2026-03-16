import { NextResponse } from 'next/server';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logWarn } from '@/lib/logger';
import { CircuitOpenError, TimeoutError, renderQuotePdfBuffer } from '@/lib/quote-pdf';
import { generateZatcaQrCode } from '@/lib/zatca';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: { id: string } }) {
  try {
    const quoteId = context.params.id;
    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: quote, error } = await supabase
      .from('quotes')
      .select(
        'id, org_id, number, items, subtotal, tax, total, currency, status, tax_number, tax_enabled, created_at, client:clients(id, name, address)',
      )
      .eq('org_id', orgId)
      .eq('id', quoteId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!quote) {
      return NextResponse.json({ error: 'عرض السعر غير موجود.' }, { status: 404 });
    }

    const orgResult = await supabase.from('organizations').select('name, logo_url, address, cr_number, tax_number').eq('id', orgId).maybeSingle();
    const org = orgResult.data;

    const clientName = Array.isArray((quote as any).client)
      ? (quote as any).client[0]?.name
      : (quote as any).client?.name;

    const clientAddress = Array.isArray((quote as any).client)
      ? (quote as any).client[0]?.address
      : (quote as any).client?.address;

    let pdfResult: Awaited<ReturnType<typeof renderQuotePdfBuffer>>;
    try {
      pdfResult = await renderQuotePdfBuffer({
        number: String(quote.number ?? ''),
        items: (quote as any).items,
        subtotal: (quote as any).subtotal,
        tax: (quote as any).tax,
        total: (quote as any).total,
        currency: String(quote.currency ?? 'SAR'),
        status: String(quote.status ?? ''),
        issued_at: String(quote.created_at ?? ''),
        clientName: clientName ? String(clientName) : null,
        clientAddress: clientAddress ? String(clientAddress) : null,
        orgName: org?.name ? String(org.name) : null,
        orgAddress: org?.address ? String(org.address) : null,
        logoUrl: org?.logo_url ? String(org.logo_url) : null,
        taxNumber: (quote as any).tax_number || org?.tax_number || null,
        crNumber: org?.cr_number ? String(org.cr_number) : null,
        qrCode: (quote as any).tax_enabled && ((quote as any).tax_number || org?.tax_number) ? generateZatcaQrCode({
          sellerName: org?.name ?? 'إدارة المكتب',
          vatNumber: String((quote as any).tax_number || org?.tax_number),
          timestamp: String(quote.created_at),
          totalAmount: String(quote.total),
          vatAmount: String(quote.tax),
        }) : null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('quote_pdf_export_transient', { message: error.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw error;
    }

    await logAudit({
      action: 'quote.pdf_export',
      entityType: 'quote',
      entityId: quoteId,
      meta: { number: quote.number },
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
    logError('quote_pdf_export_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF.' }, { status: 500 });
  }
}
