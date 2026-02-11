import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTenant } from '../common/tenant-scope';

export type AuditPayload = {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.tenantId,
        userId: payload.userId,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        ip: payload.ip,
        userAgent: payload.userAgent,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(tenantId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: withTenant(tenantId),
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where: withTenant(tenantId) }),
    ]);

    return { data, total, page, pageSize };
  }
}
