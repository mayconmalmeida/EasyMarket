import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SectorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.sector.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateSectorDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nome inválido');

    const existing = await this.prisma.sector.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Setor já existe');

    return this.prisma.sector.create({
      data: { name, status: dto.status ?? SectorStatus.ACTIVE },
    });
  }

  async update(id: string, dto: UpdateSectorDto) {
    const existing = await this.prisma.sector.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Setor não encontrado');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Nome inválido');
      data.name = name;
    }
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.prisma.sector.update({ where: { id }, data });
    } catch {
      throw new BadRequestException('Não foi possível atualizar o setor');
    }
  }
}
