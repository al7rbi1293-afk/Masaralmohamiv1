import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { enqueueNajizMatterRefresh } from '@/lib/integrations/domain/services/najiz-orchestration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid().optional(),
  case_number: z.string().trim().max(120).optional(),
  scheduled_for: z.string().datetime().optional(),
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

    const result = await enqueueNajizMatterRefresh({
      actor,
      matterId: params.matterId,
      caseNumber: parsed.data.case_number,
      scheduledFor: parsed.data.scheduled_for,
      triggerMode: parsed.data.scheduled_for ? 'scheduled' : 'manual',
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        queued: true,
        reused: result.reused,
        job_id: result.job.id,
        status: result.job.status,
        available_at: result.job.availableAt,
      },
      { status: 202 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_matter_refresh_queue_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
