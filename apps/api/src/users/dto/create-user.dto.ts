import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsString()
  @Length(4, 6)
  pin!: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  sectorId?: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
