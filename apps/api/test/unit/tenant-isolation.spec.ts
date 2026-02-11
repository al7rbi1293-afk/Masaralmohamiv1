import { ClientsService } from '../../src/clients/clients.service';

describe('Tenant isolation', () => {
  it('scopes client list queries by tenantId', async () => {
    const prisma = {
      client: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as any;

    const audit = { log: jest.fn() } as any;

    const service = new ClientsService(prisma, audit);

    await service.list('tenant-a', {
      page: 1,
      pageSize: 20,
      search: undefined,
      archived: undefined,
    });

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );

    expect(prisma.client.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });
});
