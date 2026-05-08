import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  marketName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  pixKey?: string;

  @IsOptional()
  @IsString()
  pixQrCodeUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStockDefault?: number;

  @IsOptional()
  @IsBoolean()
  collaboratorPortalEnabled?: boolean;
}
