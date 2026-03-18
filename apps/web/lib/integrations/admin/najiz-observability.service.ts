import 'server-only';

import { listIntegrationAccounts } from '../repositories/integration-accounts.repository';
import { listRecentSyncJobs, listRecentSyncLogs } from '../repositories/sync-job.repository';
import { listRecentWebhookEvents } from '../repositories/webhook-events.repository';
import type { IntegrationAdminSummary } from '../domain/models';

export async function getNajizAdminSummary(): Promise<IntegrationAdminSummary> {
  const [accounts, jobs, logs, webhooks] = await Promise.all([
    listIntegrationAccounts('najiz', 100),
    listRecentSyncJobs({ limit: 200 }),
    listRecentSyncLogs({ limit: 200 }),
    listRecentWebhookEvents({ provider: 'najiz', limit: 100 }),
  ]);

  const najizJobs = jobs.filter((job) => job.provider === 'najiz');
  const najizLogs = logs.filter((log) => log.provider === 'najiz');
  const najizWebhooks = webhooks.filter((event) => event.provider === 'najiz');

  return {
    totals: {
      accounts: accounts.length,
      connected: accounts.filter((account) => account.status === 'connected').length,
      error: accounts.filter((account) => account.status === 'error').length,
      disconnected: accounts.filter((account) => account.status === 'disconnected').length,
      healthy: accounts.filter((account) => account.healthStatus === 'healthy').length,
      degraded: accounts.filter((account) => account.healthStatus === 'degraded').length,
      queuedJobs: najizJobs.filter((job) => job.status === 'pending' || job.status === 'retrying').length,
      pendingWebhooks: najizWebhooks.filter((event) => event.status === 'pending' || event.status === 'processing').length,
    },
    accounts: accounts.map((account) => ({
      id: account.id ?? '',
      orgId: account.orgId,
      provider: account.provider,
      status: account.status,
      healthStatus: account.healthStatus,
      activeEnvironment: account.activeEnvironment,
      lastSyncedAt: account.lastSyncedAt,
      updatedAt: account.updatedAt,
    })),
    jobs: najizJobs,
    logs: najizLogs,
    webhooks: najizWebhooks,
  };
}
