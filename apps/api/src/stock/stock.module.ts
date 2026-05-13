import { Module } from '@nestjs/common';
import { AdminProductsStockController } from './admin-products-stock.controller';
import { StockEntriesController } from './stock-entries.controller';
import { StockMovementsController } from './stock-movements.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [
    StockEntriesController,
    StockMovementsController,
    AdminProductsStockController,
  ],
  providers: [StockService],
})
export class StockModule {}

