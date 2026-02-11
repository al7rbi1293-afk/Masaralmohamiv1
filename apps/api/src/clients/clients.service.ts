import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(tenantId: string, query: ListClientsDto) {
    const { page, pageSize, search, archived } = query;
    const skip = (page - 1) * pageSize;

    const where = withTenant(tenantId, {
      ...(typeof archived === 'boolean' ? { isArchived: archived } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(tenantId: string, actor: JwtUser, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'CLIENT_CREATED',
      entity: 'client',
      entityId: client.id,
    });

    return client;
  }

  async get(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: withTenant(tenantId, { id }),
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(tenantId: string, actor: JwtUser, id: string, dto: UpdateClientDto) {
    const existing = await this.get(tenantId, id);

    await this.prisma.client.updateMany({
      where: withTenant(tenantId, { id: existing.id }),
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'CLIENT_UPDATED',
      entity: 'client',
      entityId: id,
      metadata: dto,
    });

    return this.get(tenantId, id);
  }

  async archive(tenantId: string, actor: JwtUser, id: string, isArchived: boolean) {
    await this.get(tenantId, id);

    await this.prisma.client.updateMany({
      where: withTenant(tenantId, { id }),
      data: { isArchived },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: isArchived ? 'CLIENT_ARCHIVED' : 'CLIENT_UNARCHIVED',
      entity: 'client',
      entityId: id,
    });

    return this.get(tenantId, id);
  }

  async remove(tenantId: string, actor: JwtUser, id: string) {
    await this.get(tenantId, id);

    await this.prisma.client.deleteMany({
      where: withTenant(tenantId, { id }),
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'CLIENT_DELETED',
      entity: 'client',
      entityId: id,
    });

    return { success: true };
  }
}
