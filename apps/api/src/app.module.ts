import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MonthlyClosingModule } from './monthly-closing/monthly-closing.module';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { CategoriesModule } from './categories/categories.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { SectorsModule } from './sectors/sectors.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    WithdrawalsModule,
    MonthlyClosingModule,
    SettingsModule,
    SectorsModule,
    NotificationsModule,
    StockModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
