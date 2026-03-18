import { logAudit } from '@/lib/audit';
import type { IntegrationActor, JsonObject } from '../domain/models';

type IntegrationAuditParams = {
  actor: IntegrationActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: JsonObject;
  request?: Request;
};

export async function logIntegrationAudit({
  action,
  actor,
  entityType,
  entityId = null,
  meta = {},
  request,
}: IntegrationAuditParams) {
  await logAudit({
    action,
    entityType,
    entityId,
    meta: {
      integration: true,
      actor_role: actor.role,
      ...meta,
    },
    req: request as Request | undefined,
  });
}
