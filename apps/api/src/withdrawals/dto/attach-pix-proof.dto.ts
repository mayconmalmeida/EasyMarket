import { IsString } from 'class-validator';

export class AttachPixProofDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsString()
  base64!: string;
}

