import { IsOptional, IsString } from 'class-validator';
import { MonthDto } from './month.dto';

export class MonthlyClosingSummaryQuery extends MonthDto {
  @IsOptional()
  @IsString()
  sector?: string;
}
