import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { MonthlyClosingService } from './monthly-closing.service';
import { MonthlyClosingSummaryQuery } from './dto/summary.query';
import { MonthDto } from './dto/month.dto';
import { MonthlyClosingStatementQuery } from './dto/statement.query';
import { MarkUserPaymentDto } from './dto/mark-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/monthly-closings')
export class MonthlyClosingController {
  constructor(private readonly service: MonthlyClosingService) {}

  @Get('summary')
  summary(@Query() q: MonthlyClosingSummaryQuery) {
    return this.service.summary(q.year, q.month, q.sector);
  }

  @Get('statement')
  statement(@Query() q: MonthlyClosingStatementQuery) {
    return this.service.statement(q.year, q.month, q.userId);
  }

  @Post('close')
  close(@CurrentUser() user: AuthUser, @Body() dto: MonthDto) {
    return this.service.close(dto.year, dto.month, user.id);
  }

  @Patch('mark-user')
  markUser(@Body() dto: MarkUserPaymentDto) {
    return this.service.markUser(dto.year, dto.month, dto.userId, dto.status);
  }
}
