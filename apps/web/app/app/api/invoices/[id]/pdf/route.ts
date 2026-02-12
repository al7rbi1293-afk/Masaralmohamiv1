import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { ACCESS_COOKIE_NAME } from '@/lib/supabase/constants';

type InvoiceRow = {
  id: string;
  org_id: string;
  client_id: string;
  number: string;
  items: Array<{ desc: string; qty: number; unit_price: number }>;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  issued_at: string;
  due_at: string | null;
};

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 401 });
  }

  const admin = createSupabaseServerClient();
  const { data: invoiceData, error: invoiceError } = await admin
    .from('invoices')
    .select('id, org_id, client_id, number, items, subtotal, tax, total, currency, issued_at, due_at')
    .eq('id', ctx.params.id)
    .maybeSingle();

  if (invoiceError || !invoiceData) {
    return NextResponse.json({ message: 'الفاتورة غير موجودة.' }, { status: 404 });
  }

  const invoice = invoiceData as InvoiceRow;

  const { data: membership } = await admin
    .from('memberships')
    .select('id')
    .eq('org_id', invoice.org_id)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ message: 'غير مصرح.' }, { status: 403 });
  }

  const { data: orgData } = await admin
    .from('organizations')
    .select('name')
    .eq('id', invoice.org_id)
    .maybeSingle();

  const { data: clientData } = await admin
    .from('clients')
    .select('name')
    .eq('org_id', invoice.org_id)
    .eq('id', invoice.client_id)
    .maybeSingle();

  const orgName = (orgData as { name: string } | null)?.name ?? '';
  const clientName = (clientData as { name: string } | null)?.name ?? '';

  const pdfBytes = await renderInvoicePdf({
    orgName,
    clientName,
    invoice,
  });

  await admin.from('audit_logs').insert({
    org_id: invoice.org_id,
    user_id: userId,
    action: 'invoice_pdf_exported',
    entity_type: 'invoice',
    entity_id: invoice.id,
    meta: { number: invoice.number },
    ip: getRequestIp(request),
    user_agent: request.headers.get('user-agent'),
  });

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizeFileName(invoice.number)}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function renderInvoicePdf(params: {
  orgName: string;
  clientName: string;
  invoice: InvoiceRow;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = 800;

  page.drawText('Invoice', { x: margin, y, size: 22, font: fontBold, color: rgb(0.04, 0.12, 0.23) });
  y -= 28;

  if (params.orgName) {
    page.drawText(params.orgName, { x: margin, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
  }

  page.drawText(`Invoice No: ${params.invoice.number}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Client: ${params.clientName}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Issued: ${new Date(params.invoice.issued_at).toLocaleDateString('en-US')}`, {
    x: margin,
    y,
    size: 11,
    font,
  });
  y -= 16;

  if (params.invoice.due_at) {
    page.drawText(`Due: ${new Date(params.invoice.due_at).toLocaleDateString('en-US')}`, {
      x: margin,
      y,
      size: 11,
      font,
    });
    y -= 16;
  }

  y -= 10;
  const tableTop = y;

  const colDesc = margin;
  const colQty = 360;
  const colUnit = 420;
  const colTotal = 500;

  page.drawText('Item', { x: colDesc, y, size: 11, font: fontBold });
  page.drawText('Qty', { x: colQty, y, size: 11, font: fontBold });
  page.drawText('Unit', { x: colUnit, y, size: 11, font: fontBold });
  page.drawText('Total', { x: colTotal, y, size: 11, font: fontBold });
  y -= 14;

  page.drawLine({
    start: { x: margin, y },
    end: { x: 595.28 - margin, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  y -= 10;

  for (const item of params.invoice.items) {
    const lineTotal = item.qty * item.unit_price;
    page.drawText(item.desc.slice(0, 70), { x: colDesc, y, size: 10, font });
    page.drawText(String(item.qty), { x: colQty, y, size: 10, font });
    page.drawText(item.unit_price.toFixed(2), { x: colUnit, y, size: 10, font });
    page.drawText(lineTotal.toFixed(2), { x: colTotal, y, size: 10, font });
    y -= 14;

    if (y < 140) {
      // MVP: stop if too long (avoid multi-page complexity).
      break;
    }
  }

  y = Math.min(y, tableTop - 14 * 10) - 20;

  const subtotal = Number(params.invoice.subtotal);
  const tax = Number(params.invoice.tax);
  const total = Number(params.invoice.total);
  const currency = params.invoice.currency || 'SAR';

  const labelX = 360;
  const valueX = 500;

  page.drawText('Subtotal', { x: labelX, y, size: 11, font });
  page.drawText(`${subtotal.toFixed(2)} ${currency}`, { x: valueX, y, size: 11, font });
  y -= 16;
  page.drawText('Tax', { x: labelX, y, size: 11, font });
  page.drawText(`${tax.toFixed(2)} ${currency}`, { x: valueX, y, size: 11, font });
  y -= 18;
  page.drawText('Total', { x: labelX, y, size: 12, font: fontBold });
  page.drawText(`${total.toFixed(2)} ${currency}`, { x: valueX, y, size: 12, font: fontBold });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

async function getUserIdFromRequest(request: NextRequest) {
  const accessToken =
    request.headers.get('x-masar-access-token')?.trim() ||
    request.cookies.get(ACCESS_COOKIE_NAME)?.value?.trim();

  if (!accessToken) {
    return null;
  }

  const auth = createSupabaseServerAuthClient();
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(',')[0]?.trim() ?? null;
}

function sanitizeFileName(input: string) {
  return input.replaceAll(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'invoice';
}

