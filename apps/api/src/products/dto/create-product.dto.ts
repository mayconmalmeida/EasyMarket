import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsInt()
  @Min(0)
  minStock!: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
