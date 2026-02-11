import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export type TaskReminderJob = {
  taskId: string;
  tenantId: string;
  assigneeId?: string | null;
  title: string;
  dueDate?: string | null;
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly reminderQueue: Queue<TaskReminderJob>;

  constructor() {
    this.connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.reminderQueue = new Queue<TaskReminderJob>('task-reminders', {
      connection: this.connection,
    });
  }

  async enqueueTaskReminder(
    job: TaskReminderJob,
    runAt: Date,
  ) {
    const delay = Math.max(0, runAt.getTime() - Date.now());

    await this.reminderQueue.add('task-reminder', job, {
      delay,
      removeOnComplete: 200,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      jobId: `task-reminder:${job.taskId}:${runAt.getTime()}`,
    });
  }

  async onModuleDestroy() {
    await this.reminderQueue.close();
    await this.connection.quit();
  }
}
