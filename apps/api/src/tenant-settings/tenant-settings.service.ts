import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(tenantId: string, actor: JwtUser, dto: UpdateTenantSettingsDto) {
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'TENANT_SETTINGS_UPDATED',
      entity: 'tenant',
      entityId: tenantId,
      metadata: dto,
    });

    return updated;
  }
}
