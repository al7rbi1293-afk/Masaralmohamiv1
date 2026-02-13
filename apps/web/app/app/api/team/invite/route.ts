import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { checkRateLimit, getRequestIp } from '@/lib/rateLimit';
import { getPublicSiteUrl } from '@/lib/env';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const inviteSchema = z.object({
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  role: z.enum(['owner', 'lawyer', 'assistant']).default('lawyer'),
  expires_in: z.enum(['24h', '7d']).default('7d'),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `team_invite:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'تم إرسال طلبات كثيرة. حاول لاحقًا.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
        { status: 400 },
      );
    }

    const user = await getCurrentAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول.' }, { status: 401 });
    }

    const orgId = await requireOrgIdForUser();
    const supabase = createSupabaseServerRlsClient();

    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'لا تملك صلاحية لهذا الإجراء.' }, { status: 403 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (parsed.data.expires_in === '24h' ? 24 : 24 * 7));

    const email = parsed.data.email.toLowerCase();

    let token = '';
    let insertError: any = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      token = randomBytes(32).toString('base64url');
      const result = await supabase.from('org_invitations').insert({
        org_id: orgId,
        email,
        role: parsed.data.role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      });

      if (!result.error) {
        insertError = null;
        break;
      }

      insertError = result.error;
      if (!String(result.error.message || '').toLowerCase().includes('duplicate')) {
        break;
      }
    }

    if (insertError) {
      throw insertError;
    }

    const inviteUrl = `${getPublicSiteUrl()}/invite/${token}`;

    await logAudit({
      action: 'team.invite_created',
      entityType: 'org_invitation',
      meta: {
        email,
        role: parsed.data.role,
        expires_at: expiresAt.toISOString(),
      },
      req: request,
    });

    logInfo('team_invite_created', { orgId, email, role: parsed.data.role });

    return NextResponse.json({ inviteUrl }, { status: 201 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('team_invite_failed', { message });
    return NextResponse.json({ error: message }, { status: message === 'لا تملك صلاحية لهذا الإجراء.' ? 403 : 400 });
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) {
    return message;
  }

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  return 'تعذر إنشاء الدعوة. حاول مرة أخرى.';
}

