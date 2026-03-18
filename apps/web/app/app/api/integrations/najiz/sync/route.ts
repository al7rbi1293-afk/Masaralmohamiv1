import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { syncNajizCaseCatalog } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid().optional(),
  endpoint_path: z
    .string()
    .trim()
    .min(1, 'مسار Endpoint مطلوب.')
    .max(300, 'مسار Endpoint طويل جدًا.')
    .optional(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:sync:${ip}`,
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
      { error: parsed.error.issues[0]?.message ?? 'البيانات غير صحيحة.' },
      { status: 400 },
    );
  }

  try {
    const actor = await requireIntegrationActor({
      orgId: parsed.data.org_id,
      allowedRoles: ['admin', 'owner'],
    });
    const result = await syncNajizCaseCatalog({
      actor,
      endpointPath: parsed.data.endpoint_path,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        imported_count: result.cases.length,
        received_count: result.cases.length,
        job_id: result.job.id,
      },
      { status: 200 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_sync_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
