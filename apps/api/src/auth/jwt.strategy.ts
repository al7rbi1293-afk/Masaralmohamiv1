import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  role: Role;
  email: string;
  type: 'access';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const accessSecret = configService.get<string>('JWT_ACCESS_SECRET')?.trim();
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET must be configured.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  validate(payload: AccessTokenPayload) {
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
    };
  }
}
