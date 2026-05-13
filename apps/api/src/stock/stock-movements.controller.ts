import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements.dto';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/stock-movements')
export class StockMovementsController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@Query() query: ListStockMovementsQueryDto) {
    return this.stock.listMovements(query);
  }
}

