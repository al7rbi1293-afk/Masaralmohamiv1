import { NextRequest, NextResponse } from 'next/server';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { syncNajizMatterCase } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export async function POST(
  req: NextRequest,
  { params }: { params: { matterId: string } }
) {
  try {
    const actor = await requireIntegrationActor({
      allowedRoles: ['owner', 'lawyer', 'assistant'],
    });
    const body = await req.json();
    const caseNumber = typeof body?.caseNumber === 'string' ? body.caseNumber : undefined;

    if (!caseNumber) {
      return NextResponse.json({ error: 'Missing caseNumber' }, { status: 400 });
    }

    const result = await syncNajizMatterCase({
      actor,
      matterId: params.matterId,
      caseNumber,
      request: req,
    });

    const hearings = result.events.filter((event) => event.eventType === 'session');
    return NextResponse.json({
      ok: true,
      count: hearings.length,
      hearings,
    });
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'legacy_najiz_sync_hearings_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
