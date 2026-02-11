import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { BillingService } from '../../src/billing/billing.service';

describe('Core flows integration', () => {
  it('auth flow: login, refresh, logout', async () => {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'partner@sijil.sa',
      name: 'Partner',
      role: Role.PARTNER,
      isActive: true,
      passwordHash: hashedPassword,
    };

    const refreshTokens: Array<{ id: string; tokenHash: string; revokedAt: Date | null; expiresAt: Date }> = [];

    const prisma = {
      user: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (
            where.tenantId === user.tenantId &&
            where.email === user.email &&
            where.isActive === true
          ) {
            return user;
          }
          if (
            where.tenantId === user.tenantId &&
            where.id === user.id &&
            where.isActive === true
          ) {
            return user;
          }
          return null;
        }),
      },
      refreshToken: {
        create: jest.fn(async ({ data }: any) => {
          refreshTokens.push({
            id: `rt-${refreshTokens.length + 1}`,
            tokenHash: data.tokenHash,
            revokedAt: null,
            expiresAt: data.expiresAt,
          });
          return {};
        }),
        findMany: jest.fn(async () => {
          return refreshTokens.filter((token) => !token.revokedAt);
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          for (const token of refreshTokens) {
            if (where.id && token.id !== where.id) {
              continue;
            }
            token.revokedAt = data.revokedAt;
          }
          return { count: 1 };
        }),
      },
      tenant: {
        findFirst: jest.fn(async () => ({ id: user.tenantId })),
      },
    } as any;

    const jwtService = {
      signAsync: jest.fn(async (payload: any) =>
        Buffer.from(JSON.stringify(payload)).toString('base64'),
      ),
      verifyAsync: jest.fn(async (token: string) =>
        JSON.parse(Buffer.from(token, 'base64').toString('utf8')),
      ),
    } as any;

    const configService = {
      get: jest.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_TTL: '900s',
          JWT_REFRESH_TTL: '7d',
        };
        return map[key] ?? fallback;
      }),
    } as any;

    const auditService = {
      log: jest.fn(),
    } as any;

    const service = new AuthService(prisma, jwtService, configService, auditService);

    const login = await service.login({
      tenantId: user.tenantId,
      email: user.email,
      password: 'Password123!',
    });

    expect(login.accessToken).toBeDefined();
    expect(login.refreshToken).toBeDefined();

    const refreshed = await service.refresh(login.refreshToken);
    expect(refreshed.accessToken).toBeDefined();

    await service.logout(
      {
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      },
      refreshed.refreshToken,
    );

    expect(auditService.log).toHaveBeenCalled();
  });

  it('billing flow: quote to paid invoice', async () => {
    const quote = {
      id: 'q1',
      tenantId: 'tenant-1',
      clientId: 'c1',
      matterId: null,
      number: 'Q-0001',
      subtotal: '1000.00',
      tax: '150.00',
      total: '1150.00',
      invoice: null,
    };

    const invoice = {
      id: 'inv1',
      tenantId: 'tenant-1',
      status: 'UNPAID',
      number: 'INV-0001',
    } as any;

    const prisma = {
      client: {
        findFirst: jest.fn(async () => ({ id: 'c1' })),
      },
      matter: {
        findFirst: jest.fn(async () => null),
      },
      billingQuote: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id) {
            return { ...quote, invoice: null };
          }
          return quote;
        }),
        create: jest.fn(async ({ data }: any) => ({
          id: 'q-created',
          ...data,
        })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(async () => [quote]),
        count: jest.fn(async () => 1),
      },
      invoice: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id) {
            return {
              ...invoice,
              client: { name: 'Client A' },
              matter: null,
              quote: null,
              tenant: { firmName: 'Sijil Law' },
              createdBy: { name: 'Partner', email: 'partner@sijil.sa' },
              issuedAt: new Date(),
              dueAt: null,
              paidAt: null,
              subtotal: '1000.00',
              tax: '150.00',
              total: '1150.00',
            };
          }
          return invoice;
        }),
        findMany: jest.fn(async () => [invoice]),
        count: jest.fn(async () => 1),
        updateMany: jest.fn(async () => ({ count: 1 })),
        create: jest.fn(async ({ data }: any) => ({ ...invoice, ...data })),
      },
      $transaction: jest.fn(async (arg: any) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg(prisma);
      }),
    } as any;

    const auditService = { log: jest.fn() } as any;
    const service = new BillingService(prisma, auditService);

    const createdQuote = await service.createQuote(
      {
        sub: 'u1',
        tenantId: 'tenant-1',
        role: Role.PARTNER,
        email: 'partner@sijil.sa',
      },
      {
        clientId: 'c1',
        subtotal: '1000.00',
        tax: '150.00',
      },
    );

    expect(createdQuote).toBeDefined();

    const converted = await service.convertQuote(
      {
        sub: 'u1',
        tenantId: 'tenant-1',
        role: Role.PARTNER,
        email: 'partner@sijil.sa',
      },
      'q1',
      {},
    );

    expect(converted.number).toBeDefined();

    const paid = await service.markPaid(
      {
        sub: 'u1',
        tenantId: 'tenant-1',
        role: Role.PARTNER,
        email: 'partner@sijil.sa',
      },
      'inv1',
      {},
    );

    expect(paid?.status).toBeDefined();
  });
});
