import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class ListNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === '1' ? true : false))
  unreadOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
