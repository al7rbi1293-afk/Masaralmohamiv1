import { Injectable } from '@nestjs/common';
import { InvoiceStatus, MatterStatus, TaskStatus } from '@prisma/client';
import { withTenant } from '../common/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async widgets(tenantId: string) {
    const now = new Date();
    const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const staleSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [overdueTasks, upcomingDeadlines, staleMatters, unpaidInvoices] =
      await Promise.all([
        this.prisma.task.findMany({
          where: withTenant(tenantId, {
            status: { not: TaskStatus.DONE },
            dueDate: { lt: now },
          }),
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        this.prisma.task.findMany({
          where: withTenant(tenantId, {
            status: { not: TaskStatus.DONE },
            dueDate: { gte: now, lte: next7 },
          }),
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        this.prisma.matter.findMany({
          where: withTenant(tenantId, {
            status: { not: MatterStatus.CLOSED },
            updatedAt: { lte: staleSince },
          }),
          orderBy: { updatedAt: 'asc' },
          take: 10,
        }),
        this.prisma.invoice.findMany({
          where: withTenant(tenantId, {
            status: InvoiceStatus.UNPAID,
          }),
          orderBy: { dueAt: 'asc' },
          take: 10,
        }),
      ]);

    return {
      overdueTasks: {
        count: overdueTasks.length,
        items: overdueTasks,
      },
      upcomingDeadlines: {
        count: upcomingDeadlines.length,
        items: upcomingDeadlines,
      },
      staleMatters: {
        count: staleMatters.length,
        items: staleMatters,
      },
      unpaidInvoices: {
        count: unpaidInvoices.length,
        items: unpaidInvoices,
      },
    };
  }
}
