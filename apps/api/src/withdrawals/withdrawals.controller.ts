import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { SetPaymentStatusDto } from './dto/set-payment-status.dto';
import { WithdrawalsService } from './withdrawals.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post('withdrawals')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(user.id, dto);
  }

  @Patch('withdrawals/:id/confirm-pix')
  confirmPix(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (id === 'mine') return this.withdrawals.confirmPixMine(user.id);
    return this.withdrawals.confirmPix(user.id, id);
  }

  @Get('withdrawals/mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.withdrawals.listMine(user.id);
  }

  @Get('withdrawals/mine/pending')
  listPendingMine(@CurrentUser() user: AuthUser) {
    return this.withdrawals.listPendingMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/withdrawals')
  listAll() {
    return this.withdrawals.listAll();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/withdrawals/:id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.withdrawals.markPaid(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/withdrawals/:id/payment-status')
  setPaymentStatus(@Param('id') id: string, @Body() dto: SetPaymentStatusDto) {
    return this.withdrawals.setPaymentStatus(id, dto.status);
  }
}
