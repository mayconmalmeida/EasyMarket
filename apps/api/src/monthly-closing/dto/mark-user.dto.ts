import { IsEnum, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { MonthDto } from './month.dto';

export class MarkUserPaymentDto extends MonthDto {
  @IsString()
  userId!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
