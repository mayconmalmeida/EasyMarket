import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        category: dto.category,
        photoUrl: dto.photoUrl,
        priceCents: dto.priceCents,
        stock: dto.stock,
        minStock: dto.minStock,
        status: dto.status ?? ProductStatus.ACTIVE,
      },
    });
  }

  list() {
    return this.prisma.product.findMany({
      orderBy: [{ status: 'asc' }, { category: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');

    if (dto.stock !== undefined && dto.stock < 0)
      throw new BadRequestException('Estoque inválido');

    return this.prisma.product.update({
      where: { id },
      data: dto,
    });
  }
}
