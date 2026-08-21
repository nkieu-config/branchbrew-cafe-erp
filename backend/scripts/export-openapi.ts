import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

/**
 * Nest discovers routes in module-registration order, so the exported key order
 * shifts whenever the module graph changes even though the contract is
 * identical. The drift check compares text, so that churn reads as a breaking
 * change. Sorting object keys makes the export a function of the contract alone.
 * Array order is left alone — it carries meaning in `parameters` and `enum`.
 */
function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSortedKeys);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, withSortedKeys((value as Record<string, unknown>)[key])]),
  );
}

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
  writeFileSync(outputPath, JSON.stringify(withSortedKeys(document), null, 2));

  await app.close();
  console.log(`OpenAPI spec written to ${outputPath}`);
}

exportOpenApi().catch((error: unknown) => {
  console.error('Failed to export OpenAPI spec:', error);
  process.exit(1);
});
