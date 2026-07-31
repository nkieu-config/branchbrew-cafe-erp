import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function exportOpenApi(): Promise<void> {
  process.env.DATABASE_URL ??=
    'postgresql://postgres:postgres@localhost:5432/postgres';
  process.env.JWT_SECRET ??= 'openapi-export-dummy-secret-32chars';

  const app = await NestFactory.create(AppModule, { logger: false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP API')
    .setDescription('ERP backend API documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`OpenAPI spec written to ${outputPath}`);
}

exportOpenApi().catch((error: unknown) => {
  console.error('Failed to export OpenAPI spec:', error);
  process.exit(1);
});
