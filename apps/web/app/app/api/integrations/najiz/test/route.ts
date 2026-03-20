import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { testNajizHealth } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';
import { buildNajizAccountResponseSnapshot } from '../_response';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:test:${ip}`,
    limit: 30,
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
    const result = await testNajizHealth({ actor, request });

    return NextResponse.json(
      {
        ok: result.health.ok,
        status: result.account.status,
        health_status: result.account.healthStatus,
        message: result.health.message,
        account: buildNajizAccountResponseSnapshot(result.account),
      },
      { status: result.health.ok ? 200 : 400 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_test_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
