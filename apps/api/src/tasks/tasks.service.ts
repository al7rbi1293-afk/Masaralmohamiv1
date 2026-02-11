import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: JwtUser, query: ListTasksDto) {
    const skip = (query.page - 1) * query.pageSize;
    const where = withTenant(user.tenantId, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.search
        ? {
            title: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async create(user: JwtUser, dto: CreateTaskDto) {
    await this.ensureLinks(user.tenantId, dto.assigneeId, dto.matterId);

    const task = await this.prisma.task.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
        assigneeId: dto.assigneeId,
        matterId: dto.matterId,
        createdById: user.sub,
      },
    });

    await this.scheduleReminder(task.id, user.tenantId, task.assigneeId, task.title, task.reminderAt, task.dueDate);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'TASK_CREATED',
      entity: 'task',
      entityId: task.id,
    });

    return task;
  }

  async get(user: JwtUser, id: string) {
    const task = await this.prisma.task.findFirst({
      where: withTenant(user.tenantId, { id }),
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(user: JwtUser, id: string, dto: UpdateTaskDto) {
    await this.get(user, id);
    await this.ensureLinks(user.tenantId, dto.assigneeId, dto.matterId);

    await this.prisma.task.updateMany({
      where: withTenant(user.tenantId, { id }),
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
        assigneeId: dto.assigneeId,
        matterId: dto.matterId,
      },
    });

    const task = await this.get(user, id);
    await this.scheduleReminder(task.id, user.tenantId, task.assigneeId, task.title, task.reminderAt, task.dueDate);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'TASK_UPDATED',
      entity: 'task',
      entityId: id,
      metadata: dto,
    });

    return task;
  }

  async remove(user: JwtUser, id: string) {
    await this.get(user, id);

    await this.prisma.task.deleteMany({
      where: withTenant(user.tenantId, { id }),
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'TASK_DELETED',
      entity: 'task',
      entityId: id,
    });

    return { success: true };
  }

  private async ensureLinks(tenantId: string, assigneeId?: string, matterId?: string) {
    if (assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: withTenant(tenantId, { id: assigneeId, isActive: true }),
      });
      if (!user) {
        throw new NotFoundException('Assignee not found');
      }
    }

    if (matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: withTenant(tenantId, { id: matterId }),
      });
      if (!matter) {
        throw new NotFoundException('Matter not found');
      }
    }
  }

  private async scheduleReminder(
    taskId: string,
    tenantId: string,
    assigneeId: string | null,
    title: string,
    reminderAt: Date | null,
    dueDate: Date | null,
  ) {
    if (!reminderAt) {
      return;
    }

    await this.queueService.enqueueTaskReminder(
      {
        taskId,
        tenantId,
        assigneeId,
        title,
        dueDate: dueDate ? dueDate.toISOString() : null,
      },
      reminderAt,
    );
  }
}
