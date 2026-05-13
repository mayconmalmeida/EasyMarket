import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  StockMovementSource,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements.dto';

function clampTake(take?: number) {
  if (!take || take < 1) return 200;
  if (take > 500) return 500;
  return take;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function mondayOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findProductByBarcode(barcode: string) {
    const normalized = barcode.trim();
    if (!normalized) return null;
    return this.prisma.product.findUnique({ where: { barcode: normalized } });
  }

  async createEntry(actorId: string, dto: CreateStockEntryDto) {
    const barcode = dto.barcode.trim();
    if (!barcode) throw new BadRequestException('Código de barras inválido');

    const occurredAt = new Date(dto.occurredAt);
    if (Number.isNaN(occurredAt.getTime()))
      throw new BadRequestException('Data da entrada inválida');

    const quantity = dto.quantity;
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new BadRequestException('Quantidade inválida');

    return this.prisma.$transaction(async (tx) => {
      const byId = dto.productId
        ? await tx.product.findUnique({ where: { id: dto.productId } })
        : null;

      const byBarcode = !byId
        ? await tx.product.findUnique({ where: { barcode } })
        : null;

      let product = byId ?? byBarcode;

      if (!product) {
        if (!dto.product?.name?.trim() || !dto.product?.category?.trim())
          throw new BadRequestException('Informe produto e categoria');

        product = await tx.product.create({
          data: {
            barcode,
            name: dto.product.name.trim(),
            category: dto.product.category.trim(),
            priceCents: dto.priceCents,
            costCents: dto.costCents,
            stock: 0,
            minStock: 5,
            status: ProductStatus.ACTIVE,
          },
        });
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: {
          barcode: product.barcode ?? barcode,
          priceCents: dto.priceCents,
          costCents: dto.costCents ?? undefined,
          stock: { increment: quantity },
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: updated.id,
          type: StockMovementType.IN,
          source: StockMovementSource.STOCK_ENTRY,
          quantity,
          unitCostCents: dto.costCents,
          unitPriceCents: dto.priceCents,
          barcodeSnapshot: barcode,
          occurredAt,
          note: dto.note?.trim() ? dto.note.trim() : undefined,
          actorId,
        },
        include: { product: true, actor: { select: { id: true, name: true, code: true } } },
      });

      return movement;
    });
  }

  listEntries(take?: number) {
    const t = clampTake(take);
    return this.prisma.stockMovement.findMany({
      where: { type: StockMovementType.IN, source: StockMovementSource.STOCK_ENTRY },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: t,
      include: { product: true, actor: { select: { id: true, name: true, code: true } } },
    });
  }

  async listMovements(query: ListStockMovementsQueryDto) {
    const take = clampTake(query.take);

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const occurredAtWhere: Prisma.DateTimeFilter | undefined =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: to } : {}),
          }
        : undefined;

    const movementWhere: Prisma.StockMovementWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(occurredAtWhere ? { occurredAt: occurredAtWhere } : {}),
    };

    const rawTake = Math.min(take * 2, 1000);

    const [entriesAndAdjusts, outs] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          ...movementWhere,
          ...(query.type === StockMovementType.OUT || query.source === StockMovementSource.WITHDRAWAL
            ? { id: '__none__' }
            : {}),
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: rawTake,
        include: { product: true, actor: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.withdrawalItem.findMany({
        where: {
          ...(query.productId ? { productId: query.productId } : {}),
          ...(occurredAtWhere ? { withdrawal: { createdAt: occurredAtWhere } } : {}),
        },
        orderBy: { withdrawal: { createdAt: 'desc' } },
        take: rawTake,
        select: {
          id: true,
          quantity: true,
          unitPriceCents: true,
          product: true,
          withdrawal: {
            select: {
              id: true,
              createdAt: true,
              user: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    const outMovements =
      query.type && query.type !== StockMovementType.OUT
        ? []
        : query.source && query.source !== StockMovementSource.WITHDRAWAL
          ? []
          : outs.map((i) => ({
              id: `withdrawal-item:${i.id}`,
              product: i.product,
              quantity: i.quantity,
              type: StockMovementType.OUT,
              source: StockMovementSource.WITHDRAWAL,
              occurredAt: i.withdrawal.createdAt,
              actor: i.withdrawal.user,
              note: null as string | null,
              unitCostCents: null as number | null,
              unitPriceCents: i.unitPriceCents,
              barcodeSnapshot: i.product.barcode ?? null,
            }));

    const mixed = [
      ...entriesAndAdjusts.map((m) => ({
        id: m.id,
        product: m.product,
        quantity: m.quantity,
        type: m.type,
        source: m.source,
        occurredAt: m.occurredAt,
        actor: m.actor,
        note: m.note ?? null,
        unitCostCents: m.unitCostCents ?? null,
        unitPriceCents: m.unitPriceCents ?? null,
        barcodeSnapshot: m.barcodeSnapshot ?? m.product.barcode ?? null,
      })),
      ...outMovements,
    ];

    mixed.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    return mixed.slice(0, take);
  }

  async getProductDetail(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const now = new Date();
    const dayFrom = startOfDay(now);
    const weekFrom = mondayOfWeek(now);
    const monthFrom = startOfMonth(now);
    const yearFrom = startOfYear(now);
    const tomorrow = addDays(dayFrom, 1);

    const [entries, adjustments, outDayAgg, outWeekAgg, outMonthAgg, outYearAgg] =
      await Promise.all([
        this.prisma.stockMovement.findMany({
          where: {
            productId,
            type: StockMovementType.IN,
            source: StockMovementSource.STOCK_ENTRY,
          },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          take: 50,
          include: { actor: { select: { id: true, name: true, code: true } } },
        }),
        this.prisma.stockMovement.findMany({
          where: { productId, type: StockMovementType.ADJUST },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          take: 50,
          include: { actor: { select: { id: true, name: true, code: true } } },
        }),
        this.prisma.withdrawalItem.aggregate({
          where: { productId, withdrawal: { createdAt: { gte: dayFrom, lt: tomorrow } } },
          _sum: { quantity: true },
        }),
        this.prisma.withdrawalItem.aggregate({
          where: { productId, withdrawal: { createdAt: { gte: weekFrom } } },
          _sum: { quantity: true },
        }),
        this.prisma.withdrawalItem.aggregate({
          where: { productId, withdrawal: { createdAt: { gte: monthFrom } } },
          _sum: { quantity: true },
        }),
        this.prisma.withdrawalItem.aggregate({
          where: { productId, withdrawal: { createdAt: { gte: yearFrom } } },
          _sum: { quantity: true },
        }),
      ]);

    const outAll = await this.prisma.withdrawalItem.findMany({
      where: { productId },
      select: {
        quantity: true,
        unitPriceCents: true,
        withdrawal: { select: { createdAt: true, user: { select: { id: true, name: true, code: true } } } },
      },
      orderBy: { withdrawal: { createdAt: 'desc' } },
      take: 5000,
    });

    let totalSoldCents = 0;
    const buyers = new Map<
      string,
      { userId: string; name: string; code: string; quantity: number; totalCents: number }
    >();

    for (const i of outAll) {
      const cents = i.quantity * i.unitPriceCents;
      totalSoldCents += cents;
      const u = i.withdrawal.user;
      const prev = buyers.get(u.id) ?? {
        userId: u.id,
        name: u.name,
        code: u.code,
        quantity: 0,
        totalCents: 0,
      };
      prev.quantity += i.quantity;
      prev.totalCents += cents;
      buyers.set(u.id, prev);
    }

    const ranking = [...buyers.values()].sort((a, b) => b.quantity - a.quantity);
    const topBuyer = ranking[0] ?? null;

    const seriesFrom = addDays(dayFrom, -29);
    const outRecent = await this.prisma.withdrawalItem.findMany({
      where: { productId, withdrawal: { createdAt: { gte: seriesFrom, lt: tomorrow } } },
      select: { quantity: true, withdrawal: { select: { createdAt: true } } },
    });

    const bins = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = addDays(seriesFrom, i);
      const key = startOfDay(d).toISOString().slice(0, 10);
      bins.set(key, 0);
    }
    for (const i of outRecent) {
      const key = startOfDay(i.withdrawal.createdAt).toISOString().slice(0, 10);
      bins.set(key, (bins.get(key) ?? 0) + i.quantity);
    }

    const chart = {
      labels: [...bins.keys()],
      data: [...bins.values()],
    };

    const stockStatus =
      product.stock <= 0 ? 'SEM_ESTOQUE' : product.stock <= product.minStock ? 'BAIXO' : 'OK';

    return {
      product,
      stock: {
        current: product.stock,
        min: product.minStock,
        status: stockStatus,
      },
      stats: {
        outDay: outDayAgg._sum.quantity ?? 0,
        outWeek: outWeekAgg._sum.quantity ?? 0,
        outMonth: outMonthAgg._sum.quantity ?? 0,
        outYear: outYearAgg._sum.quantity ?? 0,
        totalSoldCents,
        topBuyer,
      },
      history: {
        entries,
        adjustments,
        outs: outAll.slice(0, 50).map((i) => ({
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          occurredAt: i.withdrawal.createdAt,
          actor: i.withdrawal.user,
        })),
      },
      chart,
      ranking: ranking.slice(0, 10),
    };
  }
}

