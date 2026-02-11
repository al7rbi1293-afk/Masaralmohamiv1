import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { withTenant } from '../common/tenant-scope';
import { JwtUser } from '../common/types/jwt-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AccessTokenPayload } from './jwt.strategy';

type RefreshTokenPayload = {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  tokenId: string;
  type: 'refresh';
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret-demo');
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-demo');
    this.accessTtl = this.configService.get<string>('JWT_ACCESS_TTL', '900s');
    this.refreshTtl = this.configService.get<string>('JWT_REFRESH_TTL', '7d');
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: dto.tenantId,
        email: dto.email.toLowerCase(),
        isActive: true,
      },
    });

    if (!user) {
      await this.logFailedLogin(dto.tenantId, dto.email, ip, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'auth',
        metadata: { email: dto.email, reason: 'invalid_password' },
        ip,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'auth',
      metadata: { email: user.email },
      ip,
      userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: payload.tenantId,
        id: payload.sub,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User inactive');
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        tenantId: payload.tenantId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    let matchedTokenId: string | undefined;
    for (const tokenRecord of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
      if (isMatch) {
        matchedTokenId = tokenRecord.id;
        break;
      }
    }

    if (!matchedTokenId) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    await this.prisma.refreshToken.updateMany({
      where: withTenant(payload.tenantId, { id: matchedTokenId }),
      data: { revokedAt: new Date() },
    });

    const nextTokens = await this.issueTokens(user);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'TOKEN_REFRESH',
      entity: 'auth',
      ip,
      userAgent,
    });

    return nextTokens;
  }

  async logout(user: JwtUser, refreshToken?: string, ip?: string, userAgent?: string) {
    if (refreshToken) {
      const activeTokens = await this.prisma.refreshToken.findMany({
        where: withTenant(user.tenantId, {
          userId: user.sub,
          revokedAt: null,
        }),
      });

      for (const tokenRecord of activeTokens) {
        const isMatch = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
        if (isMatch) {
          await this.prisma.refreshToken.updateMany({
            where: withTenant(user.tenantId, { id: tokenRecord.id }),
            data: { revokedAt: new Date() },
          });
        }
      }
    } else {
      await this.prisma.refreshToken.updateMany({
        where: withTenant(user.tenantId, {
          userId: user.sub,
          revokedAt: null,
        }),
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'LOGOUT',
      entity: 'auth',
      ip,
      userAgent,
    });

    return { success: true };
  }

  private async issueTokens(user: User) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      tokenId: randomUUID(),
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTtlMs = this.parseDurationToMs(this.refreshTtl);

    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return { accessToken, refreshToken };
  }

  private parseDurationToMs(duration: string): number {
    const match = /^([0-9]+)([smhd])$/.exec(duration.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];

    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;

    return value;
  }

  private async logFailedLogin(tenantId: string, email: string, ip?: string, userAgent?: string) {
    const tenantExists = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenantExists) {
      return;
    }

    await this.auditService.log({
      tenantId,
      action: 'LOGIN_FAILED',
      entity: 'auth',
      metadata: { email, reason: 'user_not_found' },
      ip,
      userAgent,
    });
  }
}
