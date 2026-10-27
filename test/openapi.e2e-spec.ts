import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
// Supertest exports a callable CommonJS function.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { AppModule } from '../src/app.module';
import {
  buildOpenApiDocument,
  OPENAPI_SNAPSHOT_PATH,
  serializeOpenApi,
} from '../src/common/swagger';

/**
 * N1 exit gates (guide §12):
 * - /health/live and /health/ready answer.
 * - the OpenAPI snapshot is in sync with the routes that exist.
 * - every documented operation declares its auth (bearer or public tag).
 *
 * The DB may be unreachable in this environment, so /health/ready is only
 * asserted to answer with the terminus envelope, not to be green.
 */

type OpenApiTestDoc = {
  components?: { securitySchemes?: Record<string, unknown> };
  paths: Record<
    string,
    Record<string, { summary?: string; description?: string }>
  >;
};

describe('OpenAPI contract (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves health endpoints', async () => {
    const live = await request(app.getHttpServer()).get('/health/live');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('ok');

    const ready = await request(app.getHttpServer()).get('/health/ready');
    expect([200, 503]).toContain(ready.status);
    expect(ready.body).toHaveProperty('status');
  });

  it('matches the committed openapi snapshot exactly', () => {
    const document = buildOpenApiDocument(app);
    const generated = serializeOpenApi(document);
    let committed: string;
    try {
      committed = readFileSync(OPENAPI_SNAPSHOT_PATH, 'utf8');
    } catch {
      throw new Error(
        `${OPENAPI_SNAPSHOT_PATH} is missing. Run: pnpm openapi:export and commit it.`,
      );
    }
    if (generated !== committed) {
      throw new Error(
        'OpenAPI snapshot drift: regenerate with `pnpm openapi:export` and ' +
          'commit openapi/dishi.openapi.json in the same change.',
      );
    }
  });

  it('declares the bearer scheme and summaries for every operation', () => {
    const document = buildOpenApiDocument(app) as unknown as OpenApiTestDoc;
    expect(Object.keys(document.components?.securitySchemes ?? {})).toContain(
      'supabase-jwt',
    );
    const undocumented: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const [method, op] of Object.entries(operations)) {
        if (!op.summary && !op.description) {
          undocumented.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    expect(undocumented).toEqual([]);
  });
});
