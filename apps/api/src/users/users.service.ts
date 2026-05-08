import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new BadRequestException('Código já está em uso');

    const pinHash = await bcrypt.hash(dto.pin, 10);
    let sectorId: string | undefined = undefined;
    let sectorName: string | undefined = undefined;

    if (dto.sectorId) {
      const s = await this.prisma.sector.findUnique({
        where: { id: dto.sectorId },
      });
      if (!s) throw new BadRequestException('Setor inválido');
      sectorId = s.id;
      sectorName = s.name;
    } else if (dto.sector) {
      const name = dto.sector.trim();
      if (name) {
        const s = await this.prisma.sector.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true, name: true },
        });
        sectorId = s.id;
        sectorName = s.name;
      }
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        code: dto.code,
        pinHash,
        sector: sectorName,
        sectorId,
        role: dto.role,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        code: true,
        sector: true,
        sectorId: true,
        role: true,
        status: true,
      },
    });
    return user;
  }

  list() {
    return this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        sector: true,
        sectorId: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuário não encontrado');

    const data: Record<string, unknown> = {
      name: dto.name,
      code: dto.code,
      role: dto.role,
      status: dto.status,
    };
    if (dto.pin) data.pinHash = await bcrypt.hash(dto.pin, 10);

    if (dto.sectorId) {
      const s = await this.prisma.sector.findUnique({
        where: { id: dto.sectorId },
      });
      if (!s) throw new BadRequestException('Setor inválido');
      data.sectorId = s.id;
      data.sector = s.name;
    } else if (dto.sector !== undefined) {
      const name = dto.sector?.trim() ?? '';
      if (!name) {
        data.sectorId = null;
        data.sector = null;
      } else {
        const s = await this.prisma.sector.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true, name: true },
        });
        data.sectorId = s.id;
        data.sector = s.name;
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        sector: true,
        sectorId: true,
        role: true,
        status: true,
      },
    });
    return user;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        code: true,
        sector: true,
        sectorId: true,
        role: true,
        status: true,
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async requestPinReset(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'PIN_RESET_REQUESTED',
        entity: 'User',
        entityId: userId,
      },
    });

    return { ok: true };
  }
}
