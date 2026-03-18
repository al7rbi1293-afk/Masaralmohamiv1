import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { verifyNajizLawyer } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid().optional(),
  lawyer_user_id: z.string().uuid().optional(),
  license_number: z.string().trim().max(120).optional(),
  national_id: z.string().trim().max(40).optional(),
  endpoint_path: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
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
    const result = await verifyNajizLawyer({
      actor,
      lawyerUserId: parsed.data.lawyer_user_id,
      licenseNumber: parsed.data.license_number,
      nationalId: parsed.data.national_id,
      endpointPath: parsed.data.endpoint_path,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: result.job.id,
        verification: result.verification,
      },
      { status: result.verification.status === 'verified' ? 200 : 202 },
    );
  } catch (error) {
    const response = toIntegrationErrorResponse(error, 'najiz_verify_lawyer_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
