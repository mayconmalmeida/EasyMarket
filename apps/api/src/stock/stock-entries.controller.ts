import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/stock-entries')
export class StockEntriesController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@Query('take') take?: string) {
    const n = take ? Number(take) : undefined;
    return this.stock.listEntries(Number.isFinite(n as number) ? (n as number) : undefined);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStockEntryDto) {
    return this.stock.createEntry(user.id, dto);
  }
}

