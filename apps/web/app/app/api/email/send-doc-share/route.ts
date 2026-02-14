import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getPublicSiteUrl } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  document_id: z.string().uuid('معرّف المستند غير صحيح.'),
  to_email: z.string().trim().email('البريد الإلكتروني غير صحيح.'),
  expires_in: z.enum(['1h', '24h', '7d'], {
    errorMap: () => ({ message: 'مدة المشاركة غير صحيحة.' }),
  }),
  message_optional: z.string().trim().max(800, 'الرسالة طويلة جدًا.').optional(),
});

const expiresSeconds: Record<z.infer<typeof bodySchema>['expires_in'], number> = {
  '1h': 60 * 60,
  '24h': 60 * 60 * 24,
  '7d': 60 * 60 * 24 * 7,
};

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `email:doc_share:${ip}`,
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

  try {
    const orgId = await requireOrgIdForUser();
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    const rls = createSupabaseServerRlsClient();

    const { data: document, error: docError } = await rls
      .from('documents')
      .select('id, title')
      .eq('org_id', orgId)
      .eq('id', parsed.data.document_id)
      .maybeSingle();

    if (docError) {
      throw docError;
    }

    if (!document) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const expiresAt = new Date(Date.now() + expiresSeconds[parsed.data.expires_in] * 1000);
    const siteUrl = getPublicSiteUrl();

    let shareUrl = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = crypto.randomBytes(32).toString('base64url');

      const { error: insertShareError } = await rls.from('document_shares').insert({
        org_id: orgId,
        document_id: parsed.data.document_id,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: currentUser.id,
      });

      if (insertShareError) {
        const msg = insertShareError.message.toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          continue;
        }
        throw insertShareError;
      }

      shareUrl = `${siteUrl}/share/${token}`;
      break;
    }

    if (!shareUrl) {
      return NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة.' }, { status: 500 });
    }

    const subject = `مشاركة مستند - مسار المحامي`;
    const textParts = [
      'مرحباً،',
      '',
      `تمت مشاركة مستند معك: ${(document as any).title ?? ''}`.trim(),
      parsed.data.message_optional ? `\nرسالة:\n${parsed.data.message_optional.trim()}\n` : '',
      'رابط التنزيل (مؤقت):',
      shareUrl,
      '',
      'ملاحظة: الرابط مؤقت وسيتم إيقافه تلقائياً.',
    ].filter(Boolean);

    await sendEmail({
      to: parsed.data.to_email,
      subject,
      text: textParts.join('\n'),
    });

    const { error: logErrorInsert } = await rls.from('email_logs').insert({
      org_id: orgId,
      sent_by: currentUser.id,
      to_email: parsed.data.to_email,
      subject,
      template: 'doc_share',
      meta: {
        document_id: parsed.data.document_id,
        expires_in: parsed.data.expires_in,
        expires_at: expiresAt.toISOString(),
      },
      status: 'sent',
    });

    if (logErrorInsert) {
      // Do not fail the request if logging failed.
      logError('email_log_insert_failed', { message: logErrorInsert.message });
    }

    logInfo('email_sent_doc_share', { documentId: parsed.data.document_id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('email_send_doc_share_failed', { message });

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

