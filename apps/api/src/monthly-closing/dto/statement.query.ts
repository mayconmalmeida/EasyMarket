import { IsString } from 'class-validator';
import { MonthDto } from './month.dto';

export class MonthlyClosingStatementQuery extends MonthDto {
  @IsString()
  userId!: string;
}
