import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function isPaid(status: PaymentStatus) {
  return (
    status === PaymentStatus.PAID || status === PaymentStatus.PAYROLL_DEDUCTION
  );
}

@Injectable()
export class MonthlyClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async summary(year: number, month: number, sector?: string) {
    const { start, end } = monthRange(year, month);

    const closing = await this.prisma.monthlyClosing.findFirst({
      where: { year, month },
      select: { id: true, closedAt: true },
    });

    const where: Prisma.WithdrawalWhereInput = closing
      ? { monthlyClosingId: closing.id }
      : { monthlyClosingId: null, createdAt: { gte: start, lt: end } };

    if (sector) {
      where.user = { sector };
    }

    const withdrawals = await this.prisma.withdrawal.findMany({
      where,
      select: {
        id: true,
        totalCents: true,
        paymentStatus: true,
        createdAt: true,
        userId: true,
        user: { select: { id: true, name: true, code: true, sector: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const perUser = new Map<
      string,
      {
        userId: string;
        name: string;
        code: string;
        sector: string | null;
        consumedCents: number;
        paidCents: number;
        pendingCents: number;
        hasPayroll: boolean;
      }
    >();

    for (const w of withdrawals) {
      const current = perUser.get(w.userId) ?? {
        userId: w.userId,
        name: w.user.name,
        code: w.user.code,
        sector: w.user.sector ?? null,
        consumedCents: 0,
        paidCents: 0,
        pendingCents: 0,
        hasPayroll: false,
      };

      current.consumedCents += w.totalCents;
      if (isPaid(w.paymentStatus)) current.paidCents += w.totalCents;
      else current.pendingCents += w.totalCents;
      if (w.paymentStatus === PaymentStatus.PAYROLL_DEDUCTION)
        current.hasPayroll = true;

      perUser.set(w.userId, current);
    }

    const rows = [...perUser.values()]
      .map((r) => ({
        ...r,
        status:
          r.pendingCents > 0
            ? PaymentStatus.PENDING
            : r.hasPayroll
              ? PaymentStatus.PAYROLL_DEDUCTION
              : PaymentStatus.PAID,
      }))
      .sort(
        (a, b) =>
          b.pendingCents - a.pendingCents || a.name.localeCompare(b.name),
      );

    const totals = rows.reduce(
      (acc, r) => {
        acc.totalConsumedCents += r.consumedCents;
        acc.totalPaidCents += r.paidCents;
        acc.totalPendingCents += r.pendingCents;
        if (r.pendingCents > 0) acc.usersWithDebt += 1;
        return acc;
      },
      {
        totalConsumedCents: 0,
        totalPaidCents: 0,
        totalPendingCents: 0,
        usersWithDebt: 0,
      },
    );

    return {
      year,
      month,
      closed: !!closing,
      closedAt: closing?.closedAt ?? null,
      totals,
      rows,
      recentWithdrawals: withdrawals.slice(0, 10),
    };
  }

  async close(year: number, month: number, adminUserId: string) {
    const { start, end } = monthRange(year, month);

    const existing = await this.prisma.monthlyClosing.findFirst({
      where: { year, month },
    });
    if (existing) return { id: existing.id, alreadyClosed: true };

    return this.prisma.$transaction(async (tx) => {
      const closing = await tx.monthlyClosing.create({
        data: { year, month, closedById: adminUserId },
        select: { id: true, closedAt: true },
      });

      await tx.withdrawal.updateMany({
        where: { monthlyClosingId: null, createdAt: { gte: start, lt: end } },
        data: { monthlyClosingId: closing.id },
      });

      return {
        id: closing.id,
        closedAt: closing.closedAt,
        alreadyClosed: false,
      };
    });
  }

  async statement(year: number, month: number, userId: string) {
    const { start, end } = monthRange(year, month);

    const closing = await this.prisma.monthlyClosing.findFirst({
      where: { year, month },
      select: { id: true },
    });
    const where: Prisma.WithdrawalWhereInput = closing
      ? { monthlyClosingId: closing.id, userId }
      : { monthlyClosingId: null, createdAt: { gte: start, lt: end }, userId };

    const withdrawals = await this.prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } }, user: true },
    });

    const totals = withdrawals.reduce(
      (acc, w) => {
        acc.consumedCents += w.totalCents;
        if (isPaid(w.paymentStatus)) acc.paidCents += w.totalCents;
        else acc.pendingCents += w.totalCents;
        return acc;
      },
      { consumedCents: 0, paidCents: 0, pendingCents: 0 },
    );

    return { year, month, totals, withdrawals };
  }

  async markUser(
    year: number,
    month: number,
    userId: string,
    status: PaymentStatus,
  ) {
    if (status === PaymentStatus.PENDING)
      throw new BadRequestException('Status inválido para marcação');

    const { start, end } = monthRange(year, month);
    const closing = await this.prisma.monthlyClosing.findFirst({
      where: { year, month },
      select: { id: true },
    });

    const where: Prisma.WithdrawalWhereInput = closing
      ? {
          monthlyClosingId: closing.id,
          userId,
          paymentStatus: PaymentStatus.PENDING,
        }
      : {
          monthlyClosingId: null,
          createdAt: { gte: start, lt: end },
          userId,
          paymentStatus: PaymentStatus.PENDING,
        };

    const result = await this.prisma.withdrawal.updateMany({
      where,
      data: { paymentStatus: status },
    });

    if (result.count > 0) {
      await this.notifications.notifyCollaboratorPaymentRecorded({
        userId,
        year,
        month,
        status,
        withdrawalsCount: result.count,
      });
    }
    return { updated: result.count };
  }
}
