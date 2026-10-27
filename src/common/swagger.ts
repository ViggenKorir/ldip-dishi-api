import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';

/**
 * One place builds the OpenAPI document, so `/api/docs`, `/api/docs-json`
 * and the committed snapshot `openapi/dishi.openapi.json` can never drift
 * from each other (guide §10.1). The snapshot is the contract; CI fails on
 * an undocumented diff.
 */

export const OPENAPI_SNAPSHOT_PATH = 'openapi/dishi.openapi.json';

export const buildOpenApiDocument = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Dishi API')
    .setVersion('0.1.0')
    .setDescription(
      [
        'The Dishi backend. Conventions:',
        '',
        '- Money is **integer KES**; no decimals anywhere.',
        '- Time is **UTC in the database**, `Africa/Nairobi` at the edge.',
        '- Phones are **E.164** (`+2547XXXXXXXX`).',
        '- Lists return `{ data, page: { nextCursor, hasMore } }` (cursor) ' +
          'or `{ data, page: { limit, offset, total } }` for admin tables.',
        '- Errors are RFC 7807 `application/problem+json` with a stable ' +
          '`code`: VALIDATION_FAILED, UNAUTHENTICATED, PERMISSION_DENIED, ' +
          'MFA_REQUIRED, STEP_UP_REQUIRED, ACCOUNT_SUSPENDED, NOT_FOUND, ' +
          'ORDER_STATE_CONFLICT, ITEM_SOLD_OUT, STORE_NOT_ACCEPTING, ' +
          'SLOT_FULL, COUPON_INVALID, PAYMENT_AMOUNT_MISMATCH, ' +
          'IDEMPOTENCY_CONFLICT, LAST_SUPERADMIN, PERMISSION_ESCALATION, ' +
          'RATE_LIMITED.',
        '- `X-Request-Id` is accepted and echoed; every error carries it.',
        '- `Idempotency-Key` is required on money-moving POSTs (from N5).',
        '- `X-Dishi-Context` (`customer`, `vendor:<uuid>`, `platform`) ' +
          'selects the active actor context and is re-validated on every ' +
          'request (from N2).',
        '',
        'Identity is a Nest-issued JWT obtained from `POST /auth/signin` or ' +
        'the social hand-off; `Authorization: Bearer <token>`.',
      ].join('\n'),
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Nest JWT (sub = nest user uuid). Paste one from POST /auth/signin.',
      },
      'nest-jwt',
    )
    .addTag('health', 'Liveness and readiness; public, unthrottled')
    .addTag('auth', 'Sign-up, sign-in and the social hand-off (legacy paths)')
    .addTag('users', 'Legacy profile endpoint; superseded by /me in N2')
    .addTag('meta', 'Echo/debug routes; being retired')
    .addTag(
      'deprecated',
      'Starter scaffolding (bookmarks, projects); not Dishi domain',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
};

/** Stable serialization for both the file and the snapshot test. */
export const serializeOpenApi = (document: object): string =>
  JSON.stringify(document, null, 2) + '\n';

export const writeOpenApiSnapshot = (document: object): void => {
  writeFileSync(OPENAPI_SNAPSHOT_PATH, serializeOpenApi(document));
};

export const setupSwagger = (app: INestApplication): void => {
  const document = buildOpenApiDocument(app);
  // UI at /api/docs, raw spec at /api/docs-json (guide §10.1).
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
};
