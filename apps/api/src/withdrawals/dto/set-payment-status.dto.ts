import { IsEnum } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class SetPaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
