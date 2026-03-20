import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { validateNajizPowerOfAttorney } from '@/lib/integrations/domain/services/najiz-integration.service';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';

const bodySchema = z.object({
  poa_number: z.string().trim().max(120).optional(),
  poaNumber: z.string().trim().max(120).optional(),
  endpoint_path: z.string().trim().max(300).optional(),
});

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'البيانات غير صحيحة.' }, { status: 400 });
    }

    const actor = await requireIntegrationActor({
      allowedRoles: ['admin', 'owner', 'lawyer', 'assistant'],
    });
    const result = await validateNajizPowerOfAttorney({
      actor,
      clientId: params.clientId,
      poaNumber: parsed.data.poa_number ?? parsed.data.poaNumber,
      endpointPath: parsed.data.endpoint_path,
      request: req,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result.validation,
        validation: result.validation,
      },
      { status: 200 },
    );
  } catch (error: any) {
    const response = toIntegrationErrorResponse(error, 'najiz_validate_poa_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
