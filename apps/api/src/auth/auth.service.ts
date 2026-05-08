import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(code: string, pin: string) {
    const user = await this.prisma.user.findUnique({ where: { code } });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('Usuário bloqueado');

    const pinOk = await bcrypt.compare(pin, user.pinHash);
    if (!pinOk) throw new UnauthorizedException('Credenciais inválidas');

    const tokens = await this.issueTokens(user.id, user.role);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        code: user.code,
        role: user.role,
        sector: user.sector,
        sectorId: user.sectorId,
      },
      ...tokens,
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshTokenHash)
      throw new UnauthorizedException('Sessão inválida');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('Usuário bloqueado');

    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Sessão inválida');

    const tokens = await this.issueTokens(user.id, user.role);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, role };
    const accessExpiresIn = (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as StringValue;
    const refreshExpiresIn = (this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) ?? '30d') as StringValue;
    const accessToken = await this.jwt.signAsync(payload, {
      secret:
        this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret:
        this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
      expiresIn: refreshExpiresIn,
    });
    return { accessToken, refreshToken };
  }
}
