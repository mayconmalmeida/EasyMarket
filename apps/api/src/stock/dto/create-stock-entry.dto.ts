import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateInlineProductDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;
}

export class CreateStockEntryDto {
  @IsString()
  barcode!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInlineProductDto)
  product?: CreateInlineProductDto;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

