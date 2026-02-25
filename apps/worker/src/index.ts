import { PrismaClient, TaskStatus } from '@prisma/client';
import { type ConnectionOptions, Worker } from 'bullmq';

type TaskReminderJob = {
  taskId: string;
  tenantId: string;
  assigneeId?: string | null;
  title: string;
  dueDate?: string | null;
};

const prisma = new PrismaClient();

const connection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  maxRetriesPerRequest: null,
};

const worker = new Worker<TaskReminderJob>(
  'task-reminders',
  async (job) => {
    const { taskId, tenantId, assigneeId, title, dueDate } = job.data;

    const task = await prisma.task.findFirst({
      where: {
        tenantId,
        id: taskId,
        status: { not: TaskStatus.DONE },
      },
    });

    if (!task) {
      return;
    }

    const assignee = assigneeId
      ? await prisma.user.findFirst({
          where: {
            tenantId,
            id: assigneeId,
            isActive: true,
          },
        })
      : null;

    const notificationTarget = assignee?.email ?? 'team@sijil.local';
    const dueText = dueDate ? new Date(dueDate).toISOString().slice(0, 10) : 'N/A';

    console.log(
      `[Reminder Email] tenant=${tenantId} to=${notificationTarget} task="${title}" due=${dueText}`,
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: assignee?.id,
        action: 'TASK_REMINDER_SENT',
        entity: 'task',
        entityId: taskId,
        metadata: {
          title,
          to: notificationTarget,
        },
      },
    });
  },
  { connection },
);

worker.on('ready', () => {
  console.log('Sijil worker ready');
});

worker.on('completed', (job) => {
  console.log(`Reminder job completed: ${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`Reminder job failed: ${job?.id}`, error);
});

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
