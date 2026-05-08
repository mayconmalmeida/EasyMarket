import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SectorStatus } from '@prisma/client';

export class CreateSectorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(SectorStatus)
  status?: SectorStatus;
}
