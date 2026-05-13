import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, StockMovementSource, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        barcode: dto.barcode?.trim() ? dto.barcode.trim() : undefined,
        name: dto.name,
        category: dto.category,
        photoUrl: dto.photoUrl,
        costCents: dto.costCents,
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

  async update(id: string, actorId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');

    if (dto.stock !== undefined && dto.stock < 0)
      throw new BadRequestException('Estoque inválido');

    const barcode = dto.barcode?.trim() ? dto.barcode.trim() : dto.barcode;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { ...dto, ...(dto.barcode !== undefined ? { barcode } : {}) },
      });

      if (dto.stock !== undefined && dto.stock !== existing.stock) {
        const delta = dto.stock - existing.stock;
        await tx.stockMovement.create({
          data: {
            productId: id,
            type: StockMovementType.ADJUST,
            source: StockMovementSource.MANUAL_ADJUSTMENT,
            quantity: delta,
            occurredAt: new Date(),
            actorId,
            barcodeSnapshot: updated.barcode ?? undefined,
          },
        });
      }

      return updated;
    });
  }
}
