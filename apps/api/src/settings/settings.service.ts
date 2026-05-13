import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate() {
    const existing = await this.prisma.appSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.appSettings.create({ data: { marketName: 'Mercadinho SINNC' } });
  }

  async publicSettings() {
    const s = await this.getOrCreate();
    return {
      marketName: s.marketName,
      logoUrl: s.logoUrl,
      pixKey: s.pixKey,
      pixQrCodeUrl: s.pixQrCodeUrl,
      primaryColor: s.primaryColor,
      minStockDefault: s.minStockDefault,
      collaboratorPortalEnabled: s.collaboratorPortalEnabled,
    };
  }

  async adminGet() {
    return this.getOrCreate();
  }

  async adminUpdate(dto: UpdateSettingsDto) {
    const existing = await this.getOrCreate();
    return this.prisma.appSettings.update({
      where: { id: existing.id },
      data: {
        marketName: dto.marketName?.trim() || undefined,
        logoUrl: dto.logoUrl === null ? null : dto.logoUrl?.trim(),
        pixKey: dto.pixKey?.trim(),
        pixQrCodeUrl: dto.pixQrCodeUrl?.trim(),
        primaryColor: dto.primaryColor?.trim(),
        minStockDefault: dto.minStockDefault,
        collaboratorPortalEnabled: dto.collaboratorPortalEnabled,
      },
    });
  }
}
