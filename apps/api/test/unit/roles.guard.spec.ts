import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../src/common/guards/roles.guard';

describe('RolesGuard', () => {
  const makeContext = (role: Role) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  it('allows when user role is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.PARTNER]),
    } as any;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(Role.PARTNER))).toBe(true);
  });

  it('throws when user role is not allowed', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.PARTNER]),
    } as any;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext(Role.ASSISTANT))).toThrow(
      ForbiddenException,
    );
  });

  it('allows when route has no role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext(Role.ASSISTANT))).toBe(true);
  });
});
