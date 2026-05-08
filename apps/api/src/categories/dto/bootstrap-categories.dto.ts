import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BootstrapCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  names!: string[];
}
