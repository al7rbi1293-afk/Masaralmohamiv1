import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { requireClientPortalContext } from '@/lib/mobile/client-portal';
import { CircuitOpenError, TimeoutError, renderQuotePdfBuffer } from '@/lib/quote-pdf';
import { generateZatcaQrCode } from '@/lib/zatca';

export const runtime = 'nodejs';

type QuoteRow = {
  id: string;
  number: string;
  items: unknown;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  currency: string | null;
  status: string;
  created_at: string;
  tax_number: string | null;
  tax_enabled: boolean;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireClientPortalContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { db, session } = auth.context;
  const params = await Promise.resolve(context.params);
  const quoteId = params.id;

  try {
    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .select('id, number, items, subtotal, tax, total, currency, status, tax_number, tax_enabled, created_at')
      .eq('org_id', session.orgId)
      .eq('client_id', session.clientId)
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteError) {
      logError('mobile_client_portal_quote_pdf_lookup_failed', { message: quoteError.message });
      return NextResponse.json({ error: 'تعذر تجهيز ملف عرض السعر.' }, { status: 400 });
    }

    if (!quote) {
      return NextResponse.json({ error: 'عرض السعر غير متاح.' }, { status: 404 });
    }

    const quoteRow = quote as QuoteRow;

    const [{ data: client }, { data: org }] = await Promise.all([
      db.from('clients').select('name, address').eq('org_id', session.orgId).eq('id', session.clientId).maybeSingle(),
      db.from('organizations').select('name, address, logo_url, cr_number, tax_number').eq('id', session.orgId).maybeSingle(),
    ]);

    let pdfResult: Awaited<ReturnType<typeof renderQuotePdfBuffer>>;
    try {
      pdfResult = await renderQuotePdfBuffer({
        number: String(quoteRow.number ?? ''),
        items: quoteRow.items,
        subtotal: quoteRow.subtotal,
        tax: quoteRow.tax,
        total: quoteRow.total,
        currency: String(quoteRow.currency ?? 'SAR'),
        status: String(quoteRow.status ?? ''),
        issued_at: String(quoteRow.created_at ?? ''),
        clientName: client?.name ? String(client.name) : null,
        clientAddress: (client as any)?.address ? String((client as any).address) : null,
        orgName: org?.name ? String(org.name) : null,
        orgAddress: org?.address ? String(org.address) : null,
        logoUrl: org?.logo_url ? String(org.logo_url) : null,
        taxNumber: quoteRow.tax_number || org?.tax_number || null,
        crNumber: org?.cr_number || null,
        qrCode:
          (quoteRow as any).tax_enabled && (quoteRow.tax_number || org?.tax_number)
            ? generateZatcaQrCode({
                sellerName: org?.name ?? 'إدارة المكتب',
                vatNumber: String(quoteRow.tax_number || org?.tax_number),
                timestamp: String(quoteRow.created_at),
                totalAmount: String(quoteRow.total),
                vatAmount: String(quoteRow.tax),
              })
            : null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('mobile_client_portal_quote_pdf_transient', { message: error.message });
        return NextResponse.json({ error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' }, { status: 503 });
      }
      throw error;
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: session.orgId,
      user_id: null,
      action: 'mobile_client_portal_quote_pdf_export',
      entity_type: 'quote',
      entity_id: quoteId,
      meta: {
        portal_user_id: session.portalUserId,
        number: quoteRow.number,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('mobile_client_portal_quote_pdf_exported', {
      orgId: session.orgId,
      clientId: session.clientId,
      quoteId,
    });

    return new NextResponse(pdfResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.fileName}"`,
      },
    });
  } catch (error) {
    logError('mobile_client_portal_quote_pdf_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
      quoteId,
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF لعرض السعر.' }, { status: 500 });
  }
}
