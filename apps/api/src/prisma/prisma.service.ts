import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly tenantScopedModels = new Set([
    'User',
    'RefreshToken',
    'Client',
    'Matter',
    'MatterMember',
    'MatterTimelineEvent',
    'DocumentFolder',
    'Document',
    'DocumentVersion',
    'DocumentShareToken',
    'Task',
    'BillingQuote',
    'Invoice',
    'AuditLog',
  ]);

  constructor() {
    super();

    this.$use(async (params, next) => {
      if (!params.model || !this.tenantScopedModels.has(params.model)) {
        return next(params);
      }

      const action = params.action;
      const args = params.args ?? {};

      if (['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert'].includes(action)) {
        throw new Error(
          `Unsafe query ${params.model}.${action}. Use tenant-scoped findFirst/findMany/updateMany/deleteMany.`,
        );
      }

      if (
        [
          'findMany',
          'findFirst',
          'findFirstOrThrow',
          'count',
          'aggregate',
          'groupBy',
          'updateMany',
          'deleteMany',
        ].includes(action)
      ) {
        const hasTenant = this.containsTenantId(args.where);
        if (!hasTenant) {
          throw new Error(`Missing tenantId scope in ${params.model}.${action}`);
        }
      }

      if (action === 'create') {
        if (!args?.data?.tenantId) {
          throw new Error(`Missing tenantId in ${params.model}.create`);
        }
      }

      if (action === 'createMany') {
        const data = args.data;
        if (Array.isArray(data)) {
          const invalid = data.some((item) => !item?.tenantId);
          if (invalid) {
            throw new Error(`Missing tenantId in ${params.model}.createMany`);
          }
        } else if (!data?.tenantId) {
          throw new Error(`Missing tenantId in ${params.model}.createMany`);
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private containsTenantId(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'tenantId')) {
      return true;
    }

    return Object.values(value).some((entry) => {
      if (Array.isArray(entry)) {
        return entry.some((item) => this.containsTenantId(item));
      }
      return this.containsTenantId(entry);
    });
  }
}
