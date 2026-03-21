import { NextRequest, NextResponse } from 'next/server';
import { getRequestIp } from '@/lib/rateLimit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { requireOfficeAppContext } from '@/lib/mobile/auth';
import { getOfficeBillingRecord } from '@/lib/mobile/office-billing-crud';
import { CircuitOpenError, TimeoutError, renderQuotePdfBuffer } from '@/lib/quote-pdf';
import { generateZatcaQrCode } from '@/lib/zatca';

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
    if (!record || record.kind !== 'quote') {
      return NextResponse.json({ error: 'عرض السعر غير متاح.' }, { status: 404 });
    }

    const quote = record.quote;
    const [clientRes, orgRes] = await Promise.all([
      db
        .from('clients')
        .select('name, address')
        .eq('org_id', orgId)
        .eq('id', quote.client_id)
        .maybeSingle(),
      db
        .from('organizations')
        .select('name, address, logo_url, cr_number, tax_number')
        .eq('id', orgId)
        .maybeSingle(),
    ]);

    let pdfResult: Awaited<ReturnType<typeof renderQuotePdfBuffer>>;
    try {
      pdfResult = await renderQuotePdfBuffer({
        number: String(quote.number ?? ''),
        items: quote.items,
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        currency: String(quote.currency ?? 'SAR'),
        status: String(quote.status ?? ''),
        issued_at: String(quote.created_at ?? ''),
        clientName: (clientRes.data as { name?: string | null } | null)?.name ?? null,
        clientAddress: (clientRes.data as { address?: string | null } | null)?.address ?? null,
        orgName: (orgRes.data as { name?: string | null } | null)?.name ?? null,
        orgAddress: (orgRes.data as { address?: string | null } | null)?.address ?? null,
        logoUrl: (orgRes.data as { logo_url?: string | null } | null)?.logo_url ?? null,
        taxNumber:
          (quote as { tax_number?: string | null; tax_enabled?: boolean }).tax_number ||
          (orgRes.data as { tax_number?: string | null } | null)?.tax_number ||
          null,
        crNumber: (orgRes.data as { cr_number?: string | null } | null)?.cr_number ?? null,
        qrCode:
          (quote as { tax_enabled?: boolean; tax_number?: string | null }).tax_enabled &&
          ((quote as { tax_number?: string | null }).tax_number ||
            (orgRes.data as { tax_number?: string | null } | null)?.tax_number)
            ? generateZatcaQrCode({
                sellerName: (orgRes.data as { name?: string | null } | null)?.name ?? 'إدارة المكتب',
                vatNumber: String(
                  (quote as { tax_number?: string | null }).tax_number ||
                    (orgRes.data as { tax_number?: string | null } | null)?.tax_number,
                ),
                timestamp: String(quote.created_at ?? ''),
                totalAmount: String(quote.total ?? 0),
                vatAmount: String(quote.tax ?? 0),
              })
            : null,
      });
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
        logWarn('mobile_office_quote_pdf_transient', { message: error.message });
        return NextResponse.json({ error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' }, { status: 503 });
      }
      throw error;
    }

    const ip = getRequestIp(request);
    await db.from('audit_logs').insert({
      org_id: orgId,
      user_id: null,
      action: 'mobile_office_quote_pdf_export',
      entity_type: 'quote',
      entity_id: params.id,
      meta: {
        token: auth.context.token,
        number: quote.number,
      },
      ip,
      user_agent: request.headers.get('user-agent') || null,
    });

    logInfo('mobile_office_quote_pdf_exported', {
      orgId,
      quoteId: params.id,
    });

    return new NextResponse(pdfResult.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfResult.fileName}"`,
      },
    });
  } catch (error) {
    logError('mobile_office_quote_pdf_unhandled', {
      message: error instanceof Error ? error.message : 'unknown',
      quoteId: params.id,
    });
    return NextResponse.json({ error: 'تعذر تصدير PDF لعرض السعر.' }, { status: 500 });
  }
}
