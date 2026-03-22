import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { sendEmail } from '@/lib/email';
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailMessage,
  buildInvoiceEmailSubject,
  buildRtlEmailHtmlFromText,
} from '@/lib/invoice-email-template';
import { CircuitOpenError, TimeoutError, renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { requireOfficeAppContext } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  to_email: z.string().trim().email('البريد الإلكتروني غير صحيح.').optional().or(z.literal('')).nullable(),
  message_optional: z.string().trim().max(800, 'الرسالة طويلة جدًا.').optional(),
});

type RouteParams = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: RouteParams) {
  const auth = await requireOfficeAppContext(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `mobile:invoice-email:${auth.context.user.id}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const params = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر إرسال البريد.' },
      { status: 400 },
    );
  }

  const { db, org, user } = auth.context;
  const orgId = org?.id;
  if (!orgId) {
    return NextResponse.json({ error: 'هذا الحساب لا يملك وصولاً إلى المكتب.' }, { status: 403 });
  }

  let invoiceNumber = '';
  const providedEmail = String(parsed.data.to_email ?? '').trim();

  try {
    const { data: invoice, error } = await db
      .from('invoices')
      .select(
        'id, org_id, number, client_id, items, subtotal, tax, total, currency, status, tax_number, issued_at, due_at',
      )
      .eq('org_id', orgId)
      .eq('id', params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة.' }, { status: 404 });
    }

    invoiceNumber = String((invoice as any).number ?? '').trim() || params.id;

    const [{ data: client }, { data: orgData }, { data: payments, error: paymentsError }] = await Promise.all([
      db
        .from('clients')
        .select('id, name, email')
        .eq('org_id', orgId)
        .eq('id', String((invoice as any).client_id ?? ''))
        .maybeSingle(),
      db
        .from('organizations')
        .select('name, logo_url, tax_number')
        .eq('id', orgId)
        .maybeSingle(),
      db.from('payments').select('amount').eq('org_id', orgId).eq('invoice_id', params.id),
    ]);

    if (paymentsError) {
      throw paymentsError;
    }

    const recipientEmail = providedEmail || String((client as { email?: string | null } | null)?.email ?? '').trim();
    if (!recipientEmail) {
      return NextResponse.json({ error: 'لا يوجد بريد إلكتروني معتمد لهذا العميل.' }, { status: 400 });
    }

    const paidAmount = (((payments as Array<{ amount: string | number }> | null) ?? [])).reduce((sum, row) => {
      const value = typeof row.amount === 'number' ? row.amount : Number(row.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalNumber = Number((invoice as any).total);
    const remaining = Math.max(0, (Number.isFinite(totalNumber) ? totalNumber : 0) - paidAmount);

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
        clientName: (client as { name?: string | null } | null)?.name ? String((client as { name?: string | null }).name) : null,
        orgName: (orgData as { name?: string | null } | null)?.name ? String((orgData as { name?: string | null }).name) : null,
        logoUrl: (orgData as { logo_url?: string | null } | null)?.logo_url ? String((orgData as { logo_url?: string | null }).logo_url) : null,
        paidAmount,
        remaining,
        taxNumber:
          String((invoice as any).tax_number ?? '').trim() ||
          String((orgData as { tax_number?: string | null } | null)?.tax_number ?? '').trim() ||
          null,
      });
    } catch (pdfError) {
      if (pdfError instanceof TimeoutError || pdfError instanceof CircuitOpenError) {
        logWarn('mobile_invoice_email_pdf_transient', { message: pdfError.message });
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
      clientName: (client as { name?: string | null } | null)?.name ? String((client as { name?: string | null }).name) : null,
      officeName: (orgData as { name?: string | null } | null)?.name ? String((orgData as { name?: string | null }).name) : null,
    });
    const defaultHtml = buildInvoiceEmailHtml({
      invoiceNumber,
      issuedAt: String((invoice as any).issued_at ?? ''),
      dueAt: (invoice as any).due_at ? String((invoice as any).due_at) : null,
      total: (invoice as any).total,
      currency: String((invoice as any).currency ?? 'SAR'),
      clientName: (client as { name?: string | null } | null)?.name ? String((client as { name?: string | null }).name) : null,
      officeName: (orgData as { name?: string | null } | null)?.name ? String((orgData as { name?: string | null }).name) : null,
    });

    const userMessage = parsed.data.message_optional?.trim();
    const text = userMessage || defaultText;
    const html = userMessage && userMessage !== defaultText
      ? buildRtlEmailHtmlFromText(userMessage)
      : defaultHtml;

    await sendEmail({
      to: recipientEmail,
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

    const { error: insertLogError } = await db.from('email_logs').insert({
      org_id: orgId,
      sent_by: user.id,
      to_email: recipientEmail,
      subject,
      template: 'invoice',
      meta: { invoice_id: params.id, number: invoiceNumber, source: 'mobile_office' },
      status: 'sent',
    });

    if (insertLogError) {
      logError('mobile_invoice_email_log_insert_failed', { message: insertLogError.message });
    }

    logInfo('mobile_invoice_email_sent', { orgId, invoiceId: params.id, toEmail: recipientEmail });
    return NextResponse.json({ ok: true, to_email: recipientEmail }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('mobile_invoice_email_send_failed', { message, invoiceId: params.id });

    if (orgId && user.id) {
      await db.from('email_logs').insert({
        org_id: orgId,
        sent_by: user.id,
        to_email: providedEmail || null,
        subject: buildInvoiceEmailSubject({
          invoiceNumber: invoiceNumber || params.id,
          dueAt: null,
        }),
        template: 'invoice',
        meta: { invoice_id: params.id, number: invoiceNumber || null, source: 'mobile_office' },
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
