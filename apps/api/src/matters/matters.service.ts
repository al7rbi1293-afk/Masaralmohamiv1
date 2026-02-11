import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatterStatus, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatterDto } from './dto/create-matter.dto';
import { ListMattersDto } from './dto/list-matters.dto';
import { UpdateMembersDto } from './dto/update-members.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';

@Injectable()
export class MattersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: JwtUser, query: ListMattersDto) {
    const { page, pageSize, search, status, assigneeId } = query;
    const skip = (page - 1) * pageSize;

    const filters: Prisma.MatterWhereInput = {
      ...(status ? { status } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const where: Prisma.MatterWhereInput = this.applyVisibilityScope(user, filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.matter.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          client: true,
          assignee: { select: { id: true, name: true, email: true } },
          members: {
            where: withTenant(user.tenantId),
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      }),
      this.prisma.matter.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(user: JwtUser, dto: CreateMatterDto) {
    const client = await this.prisma.client.findFirst({
      where: withTenant(user.tenantId, { id: dto.clientId }),
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const memberIds = this.normalizeMembers(user.sub, dto.memberIds ?? [], dto.assigneeId);

    const matter = await this.prisma.matter.create({
      data: {
        tenantId: user.tenantId,
        clientId: dto.clientId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? MatterStatus.OPEN,
        assigneeId: dto.assigneeId,
        isPrivate: dto.isPrivate ?? false,
        members: {
          createMany: {
            data: memberIds.map((memberId) => ({
              tenantId: user.tenantId,
              userId: memberId,
            })),
            skipDuplicates: true,
          },
        },
        timeline: {
          create: {
            tenantId: user.tenantId,
            actorId: user.sub,
            type: 'MATTER_CREATED',
            payload: {
              status: dto.status ?? MatterStatus.OPEN,
            },
          },
        },
      },
      include: {
        members: true,
        timeline: true,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'MATTER_CREATED',
      entity: 'matter',
      entityId: matter.id,
      metadata: { title: dto.title },
    });

    return matter;
  }

  async get(user: JwtUser, id: string) {
    const matter = await this.prisma.matter.findFirst({
      where: withTenant(user.tenantId, { id }),
      include: {
        client: true,
        assignee: { select: { id: true, name: true, email: true } },
        members: {
          where: withTenant(user.tenantId),
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        timeline: {
          where: withTenant(user.tenantId),
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!matter) {
      throw new NotFoundException('Matter not found');
    }

    this.ensureMatterAccess(user, matter);

    return matter;
  }

  async update(user: JwtUser, id: string, dto: UpdateMatterDto) {
    const matter = await this.get(user, id);

    const memberIds = dto.memberIds
      ? this.normalizeMembers(user.sub, dto.memberIds, dto.assigneeId ?? matter.assigneeId ?? undefined)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.matter.updateMany({
        where: withTenant(user.tenantId, { id }),
        data: {
          clientId: dto.clientId,
          title: dto.title,
          description: dto.description,
          status: dto.status,
          assigneeId: dto.assigneeId,
          isPrivate: dto.isPrivate,
        },
      });

      if (memberIds) {
        await tx.matterMember.deleteMany({
          where: withTenant(user.tenantId, { matterId: id }),
        });
        await tx.matterMember.createMany({
          data: memberIds.map((memberId) => ({
            tenantId: user.tenantId,
            matterId: id,
            userId: memberId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.matterTimelineEvent.create({
        data: {
          tenantId: user.tenantId,
          matterId: id,
          actorId: user.sub,
          type: 'MATTER_UPDATED',
          payload: dto as unknown as Prisma.InputJsonValue,
        },
      });
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'MATTER_UPDATED',
      entity: 'matter',
      entityId: id,
      metadata: dto,
    });

    return this.get(user, id);
  }

  async updateMembers(user: JwtUser, id: string, dto: UpdateMembersDto) {
    await this.get(user, id);

    const memberIds = this.normalizeMembers(user.sub, dto.memberIds, undefined);

    await this.prisma.$transaction(async (tx) => {
      await tx.matterMember.deleteMany({
        where: withTenant(user.tenantId, { matterId: id }),
      });
      await tx.matterMember.createMany({
        data: memberIds.map((memberId) => ({
          tenantId: user.tenantId,
          matterId: id,
          userId: memberId,
        })),
        skipDuplicates: true,
      });
      await tx.matterTimelineEvent.create({
        data: {
          tenantId: user.tenantId,
          matterId: id,
          actorId: user.sub,
          type: 'MATTER_MEMBERS_UPDATED',
          payload: { memberIds },
        },
      });
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'MATTER_MEMBERS_UPDATED',
      entity: 'matter',
      entityId: id,
      metadata: { memberIds },
    });

    return this.get(user, id);
  }

  async remove(user: JwtUser, id: string) {
    await this.get(user, id);

    await this.prisma.matter.deleteMany({
      where: withTenant(user.tenantId, { id }),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'MATTER_DELETED',
      entity: 'matter',
      entityId: id,
    });

    return { success: true };
  }

  private normalizeMembers(
    actorId: string,
    memberIds: string[],
    assigneeId?: string,
  ): string[] {
    const unique = new Set<string>(memberIds);
    unique.add(actorId);
    if (assigneeId) {
      unique.add(assigneeId);
    }

    return Array.from(unique);
  }

  private applyVisibilityScope(
    user: JwtUser,
    filters: Prisma.MatterWhereInput,
  ): Prisma.MatterWhereInput {
    if (user.role === Role.PARTNER) {
      return withTenant(user.tenantId, filters);
    }

    return withTenant(user.tenantId, {
      AND: [
        filters,
        {
          OR: [
            { isPrivate: false },
            { assigneeId: user.sub },
            {
              members: {
                some: withTenant(user.tenantId, { userId: user.sub }),
              },
            },
          ],
        },
      ],
    });
  }

  private ensureMatterAccess(user: JwtUser, matter: { isPrivate: boolean; assigneeId: string | null; members: { userId: string }[]; }) {
    if (!matter.isPrivate) {
      return;
    }

    if (user.role === Role.PARTNER) {
      return;
    }

    const isMember = matter.members.some((member) => member.userId === user.sub);
    const isAssignee = matter.assigneeId === user.sub;

    if (!isMember && !isAssignee) {
      throw new ForbiddenException('Private matter access denied');
    }
  }
}
