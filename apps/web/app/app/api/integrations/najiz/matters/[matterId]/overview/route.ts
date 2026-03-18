import { NextRequest, NextResponse } from 'next/server';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { getNajizMatterOverview } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { matterId: string } },
) {
  try {
    const actor = await requireIntegrationActor({
      orgId: request.nextUrl.searchParams.get('orgId'),
      allowedRoles: ['admin', 'owner', 'lawyer', 'assistant'],
    });
    const result = await getNajizMatterOverview({
      actor,
      matterId: params.matterId,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_matter_overview_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
