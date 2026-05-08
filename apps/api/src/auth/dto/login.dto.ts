import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  code!: string;

  @IsString()
  @Length(4, 6)
  pin!: string;
}
