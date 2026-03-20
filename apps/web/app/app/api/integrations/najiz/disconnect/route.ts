import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { disconnectNajizIntegration } from '@/lib/integrations/domain/services/najiz-integration.service';
import { getIntegrationAccount } from '@/lib/integrations/repositories/integration-accounts.repository';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';
import { buildNajizAccountResponseSnapshot } from '../_response';

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
    const account = (await getIntegrationAccount(actor.orgId, 'najiz').catch(() => null));

    return NextResponse.json(
      {
        ok: true,
        account: account ? buildNajizAccountResponseSnapshot(account) : null,
      },
      { status: 200 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_disconnect_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
