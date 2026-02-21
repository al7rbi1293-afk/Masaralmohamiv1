import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getPublicSiteUrl } from '@/lib/env';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

const shareSchema = z.object({
  document_id: z.string().uuid('معرّف المستند غير صحيح.'),
  expires_in: z.enum(['1h', '24h', '7d'], {
    errorMap: () => ({ message: 'مدة المشاركة غير صحيحة.' }),
  }),
});

const expiresSeconds: Record<z.infer<typeof shareSchema>['expires_in'], number> = {
  '1h': 60 * 60,
  '24h': 60 * 60 * 24,
  '7d': 60 * 60 * 24 * 7,
};

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    const limit = await checkRateLimit({
      key: `document_share:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!limit.allowed) {
      return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = shareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء رابط المشاركة.' },
        { status: 400 },
      );
    }

    const orgId = await requireOrgIdForUser();
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }

    const rls = createSupabaseServerRlsClient();

    const { data: document, error: docError } = await rls
      .from('documents')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', parsed.data.document_id)
      .maybeSingle();

    if (docError) {
      logError('document_share_failed', { message: docError.message });
      return NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة.' }, { status: 400 });
    }

    if (!document) {
      return NextResponse.json({ error: 'لا تملك صلاحية الوصول.' }, { status: 403 });
    }

    const expiresAt = new Date(Date.now() + expiresSeconds[parsed.data.expires_in] * 1000);
    const siteUrl = getPublicSiteUrl();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = crypto.randomBytes(32).toString('base64url');

      const { error: insertError } = await rls.from('document_shares').insert({
        org_id: orgId,
        document_id: parsed.data.document_id,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: currentUser.id,
      });

      if (insertError) {
        const message = insertError.message.toLowerCase();
        if (message.includes('duplicate') || message.includes('unique')) {
          continue;
        }

        logError('document_share_failed', { message: insertError.message });
        return NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة.' }, { status: 400 });
      }

      const shareUrl = `${siteUrl}/share/${token}`;
      logInfo('document_shared', { documentId: parsed.data.document_id });

      await logAudit({
        action: 'document.shared',
        entityType: 'document',
        entityId: parsed.data.document_id,
        meta: { expires_in: parsed.data.expires_in, expires_at: expiresAt.toISOString() },
        req: request,
      });

      return NextResponse.json({ shareUrl }, { status: 201 });
    }

    return NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة.' }, { status: 500 });
  } catch (error) {
    logError('document_share_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة.' }, { status: 500 });
  }
}
