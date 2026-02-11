import { Role } from '@prisma/client';

export type JwtUser = {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
};
