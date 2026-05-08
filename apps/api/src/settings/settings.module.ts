import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { AdminSettingsController } from './settings.admin.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
