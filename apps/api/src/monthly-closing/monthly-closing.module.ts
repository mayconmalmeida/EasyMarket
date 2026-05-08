import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonthlyClosingController } from './monthly-closing.controller';
import { MonthlyClosingService } from './monthly-closing.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MonthlyClosingController],
  providers: [MonthlyClosingService],
})
export class MonthlyClosingModule {}
