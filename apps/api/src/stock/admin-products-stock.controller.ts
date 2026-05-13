import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/products')
export class AdminProductsStockController {
  constructor(private readonly stock: StockService) {}

  @Get('by-barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string) {
    return this.stock.findProductByBarcode(barcode);
  }

  @Get(':id/stock-detail')
  detail(@Param('id') id: string) {
    return this.stock.getProductDetail(id);
  }
}

