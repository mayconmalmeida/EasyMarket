import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nome inválido');

    const existing = await this.prisma.category.findUnique({ where: { name } });
    if (existing) throw new BadRequestException('Categoria já existe');

    return this.prisma.category.create({
      data: {
        name,
        description: dto.description ?? '',
        color: dto.color ?? '#0057D9',
        icon: dto.icon ?? 'pi pi-tag',
        status: dto.status ?? CategoryStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoria não encontrada');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Nome inválido');
      data.name = name;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.status !== undefined) data.status = dto.status;

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
      });
    } catch {
      throw new BadRequestException('Não foi possível atualizar a categoria');
    }
  }

  async bootstrap(names: string[]) {
    const normalized = Array.from(
      new Set(names.map((n) => n.trim()).filter(Boolean)),
    );
    if (!normalized.length) return this.list();

    await this.prisma.category.createMany({
      data: normalized.map((name) => ({ name })),
      skipDuplicates: true,
    });

    return this.list();
  }
}
