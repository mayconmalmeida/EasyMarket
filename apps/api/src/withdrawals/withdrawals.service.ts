import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachPixProofDto } from './dto/attach-pix-proof.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('Usuário bloqueado');

    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = [...quantities.keys()];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: ProductStatus.ACTIVE },
      select: { id: true, stock: true, priceCents: true, name: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Produto inválido ou inativo');
    }

    for (const p of products) {
      const q = quantities.get(p.id) ?? 0;
      if (p.stock < q)
        throw new BadRequestException(`Estoque insuficiente: ${p.name}`);
    }

    const totalCents = products.reduce(
      (sum, p) => sum + (quantities.get(p.id) ?? 0) * p.priceCents,
      0,
    );

    const paymentStatus =
      dto.paymentMethod === PaymentMethod.CASH
        ? PaymentStatus.PAID
        : dto.paymentMethod === PaymentMethod.PIX && dto.pixConfirmed
          ? PaymentStatus.PAID
          : PaymentStatus.PENDING;

    const created = await this.prisma.$transaction(async (tx) => {
      for (const p of products) {
        const q = quantities.get(p.id) ?? 0;
        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: q } },
        });
      }

      return tx.withdrawal.create({
        data: {
          userId,
          totalCents,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          items: {
            create: dto.items.map((i) => {
              const p = products.find((x) => x.id === i.productId)!;
              return {
                productId: i.productId,
                quantity: i.quantity,
                unitPriceCents: p.priceCents,
              };
            }),
          },
        },
        include: { items: true },
      });
    });

    return created;
  }

  private dataDir() {
    return path.resolve(process.cwd(), '..', '..', 'data');
  }

  private pixProofDir(withdrawalId: string) {
    return path.join(this.dataDir(), 'pix-proofs', withdrawalId);
  }

  private sanitizeFileName(fileName: string) {
    return fileName
      .trim()
      .replace(/[^\w.\-() ]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 120);
  }

  private decodeBase64(input: string) {
    const raw = input.trim();
    const base64 = raw.includes('base64,') ? raw.split('base64,').pop() ?? '' : raw;
    try {
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }

  async attachPixProof(userId: string, withdrawalId: string, dto: AttachPixProofDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new NotFoundException('Retirada não encontrada');
    if (withdrawal.userId !== userId)
      throw new ForbiddenException('Acesso negado');

    const fileName = this.sanitizeFileName(dto.fileName || 'comprovante');
    const mimeType = (dto.mimeType || '').trim();
    if (!mimeType) throw new BadRequestException('Tipo de arquivo inválido');

    const buf = this.decodeBase64(dto.base64);
    if (!buf || !buf.length) throw new BadRequestException('Arquivo inválido');
    const maxBytes = 5 * 1024 * 1024;
    if (buf.length > maxBytes)
      throw new BadRequestException('Arquivo muito grande (máx. 5MB)');

    const dir = this.pixProofDir(withdrawalId);
    await fs.mkdir(dir, { recursive: true });

    const storedName = `${Date.now()}-${randomUUID()}-${fileName}`;
    const absPath = path.join(dir, storedName);
    await fs.writeFile(absPath, buf);

    const relPath = path.join('pix-proofs', withdrawalId, storedName).replace(/\\/g, '/');

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        pixProofFileName: fileName,
        pixProofMimeType: mimeType,
        pixProofPath: relPath,
        pixProofUploadedAt: new Date(),
      },
    });

    return updated;
  }

  async getPixProofAdmin(withdrawalId: string) {
    const w = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { pixProofFileName: true, pixProofMimeType: true, pixProofPath: true },
    });
    if (!w) throw new NotFoundException('Retirada não encontrada');
    if (!w.pixProofPath || !w.pixProofMimeType)
      throw new NotFoundException('Comprovante não encontrado');
    if (!w.pixProofPath.startsWith('pix-proofs/'))
      throw new NotFoundException('Comprovante não encontrado');

    const abs = path.resolve(this.dataDir(), w.pixProofPath);
    return {
      fileName: w.pixProofFileName ?? 'comprovante',
      mimeType: w.pixProofMimeType,
      stream: createReadStream(abs),
    };
  }

  async confirmPix(userId: string, withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new NotFoundException('Retirada não encontrada');
    if (withdrawal.userId !== userId)
      throw new ForbiddenException('Acesso negado');
    if (
      withdrawal.paymentMethod !== PaymentMethod.PIX &&
      withdrawal.paymentMethod !== PaymentMethod.NONE
    ) {
      throw new BadRequestException('Forma de pagamento inválida');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        paymentMethod: PaymentMethod.PIX,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const byUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, code: true },
    });
    if (byUser) {
      await this.notifications.notifyAdminsPaymentConfirmed({
        byUserId: userId,
        byUserName: byUser.name,
        byUserCode: byUser.code,
        totalCents: updated.totalCents,
        withdrawalsCount: 1,
      });
    }

    return updated;
  }

  async confirmPixMine(userId: string) {
    const where: Prisma.WithdrawalWhereInput = {
      userId,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: { in: [PaymentMethod.PIX, PaymentMethod.NONE] },
    };

    const pending = await this.prisma.withdrawal.findMany({
      where,
      select: { totalCents: true },
    });
    if (!pending.length) return { updatedCount: 0 };

    const { count } = await this.prisma.withdrawal.updateMany({
      where,
      data: {
        paymentMethod: PaymentMethod.PIX,
        paymentStatus: PaymentStatus.PAID,
      },
    });

    const byUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, code: true },
    });
    if (byUser && count > 0) {
      const totalCents = pending.reduce((sum, w) => sum + w.totalCents, 0);
      await this.notifications.notifyAdminsPaymentConfirmed({
        byUserId: userId,
        byUserName: byUser.name,
        byUserCode: byUser.code,
        totalCents,
        withdrawalsCount: count,
      });
    }

    return { updatedCount: count };
  }

  listMine(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  listPendingMine(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { userId, paymentStatus: PaymentStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  listAll() {
    return this.prisma.withdrawal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, items: { include: { product: true } } },
    });
  }

  async markPaid(withdrawalId: string) {
    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    await this.notifications.notifyCollaboratorPaymentRecorded({
      userId: updated.userId,
      status: PaymentStatus.PAID,
      withdrawalsCount: 1,
    });
    return updated;
  }

  async setPaymentStatus(withdrawalId: string, status: PaymentStatus) {
    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { paymentStatus: status },
    });
    if (status !== PaymentStatus.PENDING) {
      await this.notifications.notifyCollaboratorPaymentRecorded({
        userId: updated.userId,
        status,
        withdrawalsCount: 1,
      });
    }
    return updated;
  }
}
