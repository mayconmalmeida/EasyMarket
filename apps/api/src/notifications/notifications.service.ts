import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateNotificationInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  meta?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ) {
    const unreadOnly = opts?.unreadOnly ?? false;
    const limit = opts?.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { recipientId: userId };
    if (unreadOnly) where.readAt = null;

    const items = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return { unreadCount, items };
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Notificação não encontrada');
    if (existing.recipientId !== userId)
      throw new ForbiddenException('Acesso negado');

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async createMany(input: CreateNotificationInput[]) {
    if (!input.length) return;
    await this.prisma.notification.createMany({
      data: input.map((n) => ({
        recipientId: n.recipientId,
        type: n.type,
        title: n.title,
        message: n.message,
        meta: n.meta,
      })),
    });
  }

  async notifyAdminsPaymentConfirmed(payload: {
    byUserId: string;
    byUserName: string;
    byUserCode: string;
    totalCents: number;
    withdrawalsCount: number;
  }) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    if (!admins.length) return;

    const title = 'Pagamento confirmado via Pix';
    const message =
      payload.withdrawalsCount === 1
        ? `${payload.byUserName} (${payload.byUserCode}) confirmou Pix de R$ ${(payload.totalCents / 100).toFixed(2).replace('.', ',')}.`
        : `${payload.byUserName} (${payload.byUserCode}) confirmou Pix de R$ ${(payload.totalCents / 100).toFixed(2).replace('.', ',')} (${payload.withdrawalsCount} retiradas).`;

    await this.createMany(
      admins.map((a) => ({
        recipientId: a.id,
        type: NotificationType.PAYMENT_CONFIRMED,
        title,
        message,
        meta: {
          kind: 'PAYMENT_CONFIRMED',
          byUserId: payload.byUserId,
          byUserCode: payload.byUserCode,
          totalCents: payload.totalCents,
          withdrawalsCount: payload.withdrawalsCount,
          targetPath: '/admin/pendencias',
        },
      })),
    );
  }

  async notifyCollaboratorPaymentRecorded(payload: {
    userId: string;
    year?: number;
    month?: number;
    status: PaymentStatus;
    withdrawalsCount: number;
  }) {
    const title = 'Pagamento atualizado';
    const statusLabel =
      payload.status === PaymentStatus.PAYROLL_DEDUCTION
        ? 'Desconto em folha'
        : 'Pago';
    const scope =
      payload.year && payload.month
        ? ` (${String(payload.month).padStart(2, '0')}/${payload.year})`
        : '';
    const message =
      payload.withdrawalsCount === 1
        ? `Sua retirada foi marcada como ${statusLabel}${scope}.`
        : `${payload.withdrawalsCount} retiradas foram marcadas como ${statusLabel}${scope}.`;

    await this.createMany([
      {
        recipientId: payload.userId,
        type: NotificationType.PAYMENT_RECORDED,
        title,
        message,
        meta: {
          kind: 'PAYMENT_RECORDED',
          status: payload.status,
          targetPath: '/colaborador/pagamentos',
        },
      },
    ]);
  }
}
