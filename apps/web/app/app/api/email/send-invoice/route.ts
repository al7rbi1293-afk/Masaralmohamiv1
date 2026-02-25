import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { computeInvoicePaidAmount } from '@/lib/billing';
import { sendEmail } from '@/lib/email';
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailMessage,
  buildInvoiceEmailSubject,
  buildRtlEmailHtmlFromText,
} from '@/lib/invoice-email-template';
import { CircuitOpenError, TimeoutError, renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { logError, logInfo, logWarn } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  invoice_id: z.string().uuid('معرّف الفاتورة غير صحيح.'),
  to_email: z.string().trim().email('البريد الإلكتروني غير صحيح.'),
  message_optional: z.string().trim().max(800, 'الرسالة طويلة جدًا.').optional(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `email:invoice:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر إرسال البريد.' },
      { status: 400 },
    );
  }

  const rls = createSupabaseServerRlsClient();

  let orgId = '';
  let currentUserId = '';
  let invoiceNumber = '';

  try {
    orgId = await requireOrgIdForUser();
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }
    currentUserId = currentUser.id;

    const { data: invoice, error } = await rls
      .from('invoices')
      .select(
        'id, org_id, number, items, subtotal, tax, total, currency, status, issued_at, due_at, client:clients(id, name)',
      )
      .eq('org_id', orgId)
      .eq('id', parsed.data.invoice_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة.' }, { status: 404 });
    }

    invoiceNumber = String((invoice as any).number ?? '').trim() || parsed.data.invoice_id;

    const { data: org } = await rls
      .from('organizations')
      .select('name, logo_url')
      .eq('id', orgId)
      .maybeSingle();

    const paidAmount = await computeInvoicePaidAmount(parsed.data.invoice_id);
    const totalNumber = Number((invoice as any).total);
    const remaining = Math.max(0, (Number.isFinite(totalNumber) ? totalNumber : 0) - paidAmount);

    const clientName = Array.isArray((invoice as any).client)
      ? (invoice as any).client[0]?.name
      : (invoice as any).client?.name;

    let pdfResult: Awaited<ReturnType<typeof renderInvoicePdfBuffer>>;
    try {
      pdfResult = await renderInvoicePdfBuffer({
        number: invoiceNumber,
        items: (invoice as any).items,
        subtotal: (invoice as any).subtotal,
        tax: (invoice as any).tax,
        total: (invoice as any).total,
        currency: String((invoice as any).currency ?? 'SAR'),
        status: String((invoice as any).status ?? ''),
        issued_at: String((invoice as any).issued_at ?? ''),
        due_at: (invoice as any).due_at ? String((invoice as any).due_at) : null,
        clientName: clientName ? String(clientName) : null,
        orgName: org?.name ? String(org.name) : null,
        logoUrl: org?.logo_url ? String(org.logo_url) : null,
        paidAmount,
        remaining,
      });
    } catch (pdfError) {
      if (pdfError instanceof TimeoutError || pdfError instanceof CircuitOpenError) {
        logWarn('invoice_email_pdf_transient', { message: pdfError.message });
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.' },
          { status: 503 },
        );
      }
      throw pdfError;
    }

    const subject = buildInvoiceEmailSubject({
      invoiceNumber,
      dueAt: (invoice as any).due_at ? String((invoice as any).due_at) : null,
    });
    const defaultText = buildInvoiceEmailMessage({
      invoiceNumber,
      issuedAt: String((invoice as any).issued_at ?? ''),
      dueAt: (invoice as any).due_at ? String((invoice as any).due_at) : null,
      total: (invoice as any).total,
      currency: String((invoice as any).currency ?? 'SAR'),
      clientName: clientName ? String(clientName) : null,
      officeName: org?.name ? String(org.name) : null,
    });
    const defaultHtml = buildInvoiceEmailHtml({
      invoiceNumber,
      issuedAt: String((invoice as any).issued_at ?? ''),
      dueAt: (invoice as any).due_at ? String((invoice as any).due_at) : null,
      total: (invoice as any).total,
      currency: String((invoice as any).currency ?? 'SAR'),
      clientName: clientName ? String(clientName) : null,
      officeName: org?.name ? String(org.name) : null,
    });
    const userMessage = parsed.data.message_optional?.trim();
    const text = userMessage || defaultText;
    const html = userMessage && userMessage !== defaultText
      ? buildRtlEmailHtmlFromText(userMessage)
      : defaultHtml;

    await sendEmail({
      to: parsed.data.to_email,
      subject,
      text,
      html,
      attachments: [
        {
          filename: pdfResult.fileName,
          content: pdfResult.buffer,
          contentType: 'application/pdf',
        },
      ],
    });

    const { error: insertLogError } = await rls.from('email_logs').insert({
      org_id: orgId,
      sent_by: currentUserId,
      to_email: parsed.data.to_email,
      subject,
      template: 'invoice',
      meta: { invoice_id: parsed.data.invoice_id, number: invoiceNumber },
      status: 'sent',
    });

    if (insertLogError) {
      logError('email_log_insert_failed', { message: insertLogError.message });
    }

    logInfo('email_sent_invoice', { invoiceId: parsed.data.invoice_id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('email_send_invoice_failed', { message });

    // Best-effort failure log, do not leak internal errors to the client.
    if (orgId && currentUserId) {
      await rls.from('email_logs').insert({
        org_id: orgId,
        sent_by: currentUserId,
        to_email: parsed.data.to_email,
        subject: buildInvoiceEmailSubject({
          invoiceNumber: invoiceNumber || parsed.data.invoice_id,
          dueAt: null,
        }),
        template: 'invoice',
        meta: { invoice_id: parsed.data.invoice_id, number: invoiceNumber || null },
        status: 'failed',
        error: message.slice(0, 240),
      });
    }

    return NextResponse.json({ error: message }, { status: message === 'الرجاء تسجيل الدخول.' ? 401 : 400 });
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية الوصول.';
  }

  if (normalized.includes('smtp_') || normalized.includes('missing required environment variable')) {
    return 'خدمة البريد غير مفعلة حالياً.';
  }

  if (normalized.includes('authentication failed') || normalized.includes('invalid login')) {
    return 'تعذر إرسال البريد (إعدادات SMTP غير صحيحة).';
  }

  return message || 'تعذر إرسال البريد.';
}
