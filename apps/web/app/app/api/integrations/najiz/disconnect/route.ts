import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { disconnectNajizIntegration } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:disconnect:${ip}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  try {
    const actor = await requireIntegrationActor({
      orgId: request.nextUrl.searchParams.get('orgId'),
      allowedRoles: ['admin', 'owner'],
    });
    await disconnectNajizIntegration({ actor, request });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_disconnect_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
