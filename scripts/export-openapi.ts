/**
 * Export the OpenAPI document to openapi/dishi.openapi.json.
 *
 * Run on every build (package.json: openapi:export). CI fails when the
 * committed snapshot differs from a freshly generated one without the
 * snapshot being updated in the same commit (test/openapi.e2e-spec.ts).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  buildOpenApiDocument,
  OPENAPI_SNAPSHOT_PATH,
  writeOpenApiSnapshot,
} from '../src/common/swagger';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const document = buildOpenApiDocument(app);
  writeOpenApiSnapshot(document);
  await app.close();
  console.log(`Wrote ${OPENAPI_SNAPSHOT_PATH}`);
}

void main();
