import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { withTenant } from '../common/tenant-scope';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../common/types/jwt-user.type';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(tenantId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: withTenant(tenantId),
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where: withTenant(tenantId) }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(tenantId: string, actor: JwtUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: withTenant(tenantId, { email }),
    });

    if (existing) {
      throw new ConflictException('Email already used in this tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'USER_CREATED',
      entity: 'user',
      entityId: user.id,
      metadata: { role: user.role },
    });

    return user;
  }

  async updateRole(
    tenantId: string,
    actor: JwtUser,
    id: string,
    dto: UpdateUserRoleDto,
  ) {
    const target = await this.prisma.user.findFirst({
      where: withTenant(tenantId, { id }),
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.updateMany({
      where: withTenant(tenantId, { id }),
      data: { role: dto.role },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: 'USER_ROLE_UPDATED',
      entity: 'user',
      entityId: id,
      metadata: { role: dto.role },
    });

    return { id, role: dto.role };
  }

  async updateStatus(
    tenantId: string,
    actor: JwtUser,
    id: string,
    dto: UpdateUserStatusDto,
  ) {
    const target = await this.prisma.user.findFirst({
      where: withTenant(tenantId, { id }),
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.updateMany({
      where: withTenant(tenantId, { id }),
      data: { isActive: dto.isActive },
    });

    await this.auditService.log({
      tenantId,
      userId: actor.sub,
      action: dto.isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      entity: 'user',
      entityId: id,
    });

    return { id, isActive: dto.isActive };
  }
}
