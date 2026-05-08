import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from './auth.types';

const BaseJwtStrategy = PassportStrategy(Strategy);

@Injectable()
export class JwtStrategy extends BaseJwtStrategy {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        const header = req.headers?.authorization;
        if (!header) return null;
        const [type, token] = header.split(' ');
        if (type !== 'Bearer' || !token) return null;
        return token;
      },
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
