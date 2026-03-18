import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { syncNajizMatterCase } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid().optional(),
  case_number: z.string().trim().max(120).optional(),
  endpoint_path: z.string().trim().max(300).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { matterId: string } },
) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'البيانات غير صحيحة.' }, { status: 400 });
  }

  try {
    const actor = await requireIntegrationActor({
      orgId: parsed.data.org_id,
      allowedRoles: ['admin', 'owner', 'lawyer', 'assistant'],
    });
    const result = await syncNajizMatterCase({
      actor,
      matterId: params.matterId,
      caseNumber: parsed.data.case_number,
      endpointPath: parsed.data.endpoint_path,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: result.job.id,
        cases: result.cases,
        events: result.events,
      },
      { status: 200 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_matter_sync_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
