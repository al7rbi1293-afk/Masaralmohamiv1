import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { saveNajizIntegrationSettings } from '@/lib/integrations/domain/services/najiz-integration.service';
import { getIntegrationAccount } from '@/lib/integrations/repositories/integration-accounts.repository';
import { toIntegrationErrorResponse } from '@/lib/integrations/http';
import { buildNajizAccountResponseSnapshot } from '../_response';

export const runtime = 'nodejs';

const bodySchema = z.object({
  org_id: z.string().uuid().optional(),
  environment: z.enum(['sandbox', 'production'], {
    errorMap: () => ({ message: 'بيئة Najiz غير صحيحة.' }),
  }),
  base_url: z.string().trim().url('رابط Najiz غير صحيح.'),
  client_id: z.string().trim().min(1, 'معرّف العميل مطلوب.').max(200, 'معرّف العميل طويل جدًا.').optional(),
  client_secret: z.string().trim().min(1, 'سر العميل مطلوب.').max(500, 'سر العميل طويل جدًا.').optional(),
  scope_optional: z.string().trim().max(400, 'قيمة scope طويلة جدًا.').optional(),
  token_path: z.string().trim().max(200).optional(),
  health_path: z.string().trim().max(200).optional(),
  enforcement_requests_path: z.string().trim().max(300).optional(),
  documents_path: z.string().trim().max(300).optional(),
  session_minutes_path: z.string().trim().max(300).optional(),
  use_mock: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `integrations:najiz:connect:${ip}`,
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
    const existingAccount = await getIntegrationAccount(actor.orgId, 'najiz').catch(() => null);
    const existingEnvironment = existingAccount?.environments[parsed.data.environment];

    const result = await saveNajizIntegrationSettings({
      actor,
      environment: parsed.data.environment,
      baseUrl: parsed.data.base_url,
      clientId: parsed.data.client_id,
      clientSecret: parsed.data.client_secret,
      scope: parsed.data.scope_optional,
      tokenPath: parsed.data.token_path ?? existingEnvironment?.tokenPath ?? null,
      healthPath: parsed.data.health_path ?? existingEnvironment?.healthPath ?? null,
      syncPaths: {
        cases: existingEnvironment?.syncPaths.cases ?? null,
        lawyerVerification: existingEnvironment?.syncPaths.lawyerVerification ?? null,
        judicialCosts: existingEnvironment?.syncPaths.judicialCosts ?? null,
        enforcementRequests: parsed.data.enforcement_requests_path ?? existingEnvironment?.syncPaths.enforcementRequests ?? null,
        documents: parsed.data.documents_path ?? existingEnvironment?.syncPaths.documents ?? null,
        sessionMinutes: parsed.data.session_minutes_path ?? existingEnvironment?.syncPaths.sessionMinutes ?? null,
      },
      useMock: parsed.data.use_mock ?? existingEnvironment?.useMock ?? false,
      request,
    });

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
    const response = toIntegrationErrorResponse(error, 'najiz_connect_failed');
    return NextResponse.json(response.body, { status: response.status });
  }
}
