import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const envCandidates = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'apps', 'api', '.env'),
  path.join(__dirname, '..', '.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8081);
  const host = process.env.API_HOST?.trim() || '0.0.0.0';
  await app.listen(port, host);
}
void bootstrap();
