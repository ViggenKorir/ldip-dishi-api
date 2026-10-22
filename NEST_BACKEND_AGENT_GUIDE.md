# Dishi NestJS Backend: Engineering Agent Guide

Build the NestJS API that replaces Supabase as Dishi's server side. Every endpoint is documented in Swagger (OpenAPI) and verified through it.

## 0. Scope and authority

- **Specs to read first:** `AGENT_README_v2.md` (sections 6, 7, 7B: schema, actors, permissions, audit, invariants), `DASHBOARDS_AGENT_GUIDE.md` (KDS, store-state spine, dashboards, settings), and `docs/agent/DOMAIN_RULES.md` + `MIGRATION_NOTES.md` if they exist. If this guide disagrees with those on **business rules**, they win; on **API and backend structure**, this guide wins.
- **Goal:** a backend that is behaviourally identical to the current Supabase-backed data layer, then the cutover from one to the other without breaking the app. Nest is the long-term server; Supabase was always temporary.
- Rhythm, evidence and stop conditions come from `AGENT_RUNBOOK.md`. Track progress in `docs/agent/PROGRESS.md` (add an "N-phases" section).
- Hard rules carried over: no hardcoded or mock data; never weaken a test to get green; no secrets in git; Dishi copy rules (no "NEXT-GEN").

## 1. Non-negotiables

1. **Contract first.** The OpenAPI document is the contract between Next.js and Nest. It is generated from code, committed as a snapshot, and diffed in CI. A route that is not in the spec does not exist.
2. **One access decorator.** Every route uses `@Access(...)` (section 5.3), which applies enforcement **and** documents it in Swagger. A route without it fails CI. No route is accidentally public.
3. **Authorization is enforced server-side in Nest** (guards plus service-level scoping) and backed by database constraints. Clerk claims are a hint, never the authority (v2 principle).
4. **Business rules live in services, inside DB transactions,** with the same invariants as v2 (state machine, last superadmin, no privilege escalation, append-only audit).
5. **Money is integer KES. Time is UTC in the database, Africa/Nairobi at the edge. Phones are E.164** (`+2547XXXXXXXX` or `+2541XXXXXXXX`).
6. **Idempotent where money or state moves** (order placement, payment initiation, webhooks, transitions).
7. **No PII in logs, events or error messages.** Phone numbers are masked unless a permission says otherwise (and reveals are audited).

## 2. Step 0: discovery and contract extraction (required before any controller)

Read the existing codebase and database. Produce:

- `docs/agent/ENDPOINTS.md`: the final endpoint catalog (start from section 9 of this guide, correct it against reality: add what the app needs, drop what it does not).
- `docs/agent/API_CONTRACT_MAP.md`: a table mapping **every function exported from `src/lib/data/*`** to its endpoint (or "none yet", which must be resolved). This is the proof that Nest can fully replace the Supabase calls.
- `docs/agent/SQL_RULES_MAP.md`: every SQL function, trigger and RLS policy in `supabase/migrations/` mapped to the Nest service or guard that re-implements it (or to "kept in DB as a safety net").
- `docs/agent/DECISIONS.md` entries for section 14 items.

Do not start N1 until these exist and are consistent.

## 3. Target architecture

### 3.1 Stack (defaults; log any deviation)

NestJS (TypeScript, strict) · PostgreSQL (the **same database and schema** as the Supabase pilot, so no data migration is needed to start) · **Prisma** for typed access, introspected from the existing schema (`prisma db pull`), with typed raw SQL (`Prisma.sql`) for views and functions such as `vendor_live_state` (alternative if Prisma fights the schema: Drizzle or Kysely) · `class-validator` / `class-transformer` DTOs · `@nestjs/swagger` · `@nestjs/config` with boot-time env validation · `nestjs-pino` · `@nestjs/terminus` · `@nestjs/throttler` · `helmet` · `@nestjs/schedule` · `@nestjs/event-emitter` · `@nestjs/websockets` + `@nestjs/platform-socket.io` · Jest + supertest.

### 3.2 Repository layout

An `api/` folder at the repo root with its own `package.json` (decision: monorepo tooling later). If a monorepo already exists, use `apps/api`.

```
api/
  src/
    main.ts  app.module.ts
    common/        guards/ decorators/ filters/ interceptors/ pipes/ dto/ errors/
    infra/         db/ clerk/ mpesa/ sms/ storage/ realtime/ jobs/ audit/ idempotency/
    modules/       system me settings catalogue favorites orders payments coupons
                   applications invites vendor-ops business uploads promos admin-* webhooks
      <module>/    <module>.controller.ts  .service.ts  dto/  events/  <module>.e2e-spec.ts
  prisma/schema.prisma   (introspected; no migrations while Supabase owns the schema)
  test/            fixtures/ helpers/ openapi-smoke/ authz-matrix/
  openapi/dishi.openapi.json   (committed snapshot)
  docs/asyncapi.yaml           (WebSocket events)
  Dockerfile  .env.example
```

### 3.3 Layering

Controller (DTO in, DTO out, `@Access`, Swagger decorators only) → Service (rules, transactions, events) → Repository/infra (Prisma, Daraja, SMS, storage). Controllers contain no business logic. Services never read `req`. Domain events are emitted **after commit**.

### 3.4 Database access

- Nest connects with a dedicated role `dishi_api`: DML on app tables, **no DDL, no UPDATE or DELETE on `audit_log` and `order_status_events`** (grant-level, in addition to code). Schema changes remain SQL migrations in `supabase/migrations/` **until cutover completes**, and must be additive-only during the parallel run. After cutover, migrations move to Prisma Migrate with a baseline (decision).
- RLS is not relied on by Nest, but **do not drop it** during the parallel run: the Supabase path still uses it.
- Concurrency: `transition` uses `UPDATE ... WHERE id = $1 AND status = $from` (or `SELECT ... FOR UPDATE`) and returns 409 when no row is updated; slot capacity is checked and incremented under a row lock or advisory lock on (vendor, slot).

### 3.5 Configuration

Env vars are validated at boot (the app refuses to start on missing or malformed values). `.env.example` lists names only. Expected: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CORS_ORIGINS`, `SWAGGER_ENABLED`, `SWAGGER_BASIC_AUTH_USER/PASS`, `DARAJA_ENV`, `DARAJA_CONSUMER_KEY/SECRET`, `DARAJA_SHORTCODE`, `DARAJA_PASSKEY`, `DARAJA_CALLBACK_BASE_URL`, `DARAJA_CALLBACK_SECRET`, `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`, `STORAGE_*` (S3-compatible), `SENTRY_DSN`, `LOG_LEVEL`, `APP_BASE_URL`, optional `REDIS_URL`.

## 4. API conventions

- **Prefix and version:** `/api/v1/...`. Breaking changes require `/v2`. Additive changes are fine.
- **Validation:** global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. UUID params through `ParseUUIDPipe`. Body size limited.
- **Success shapes:** single resources return the DTO itself. Lists return `{ data: T[], page: { nextCursor: string|null, hasMore: boolean } }` with cursor pagination (offset pagination only for admin tables that need page numbers, and then include `total`).
- **Errors:** RFC 7807 `application/problem+json`: `{ type, title, status, detail, code, requestId, errors?: [{ field, message }] }`. One global exception filter. Stable `code` values the frontend can map to friendly copy, for example: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `MFA_REQUIRED`, `STEP_UP_REQUIRED`, `ACCOUNT_SUSPENDED`, `NOT_FOUND`, `ORDER_STATE_CONFLICT`, `ITEM_SOLD_OUT`, `STORE_NOT_ACCEPTING`, `SLOT_FULL`, `COUPON_INVALID`, `PAYMENT_AMOUNT_MISMATCH`, `IDEMPOTENCY_CONFLICT`, `LAST_SUPERADMIN`, `PERMISSION_ESCALATION`, `RATE_LIMITED`. Every `code` is documented in Swagger.
- **Idempotency:** `Idempotency-Key` header required on `POST /orders`, `POST /payments/mpesa/stk-push` and other money-moving POSTs. Store `(key, actor, route, request_hash, response)` for 24 hours. Same key and body replays the stored response; same key with a different body returns 409 `IDEMPOTENCY_CONFLICT`.
- **Rate limits:** global default plus stricter limits per route (coupon validation, promo events, deletion requests, invite acceptance, webhook endpoints by IP). Return 429 with `Retry-After`.
- **Security headers and CORS:** `helmet`; CORS allow-list from `CORS_ORIGINS`; no wildcard with credentials.
- **Request id:** accept or generate `X-Request-Id`, return it, include it in logs and error bodies.
- **Logging:** pino, JSON, redaction of `authorization`, phone numbers, tokens, M-Pesa payloads' personal fields.
- **Health:** `GET /health/live` (process up) and `GET /health/ready` (database reachable), both public and excluded from rate limiting.
- **Graceful shutdown:** drain connections and sockets on SIGTERM.

## 5. Authentication and authorization in Nest

### 5.1 Identity

A global `ClerkAuthGuard` verifies the bearer token (use `@clerk/backend`; **check the current Clerk docs for the exact verification call and claims**; do not copy outdated patterns). It attaches `req.identity = { clerkUserId, sessionClaims }`. Routes marked `@Public()` skip it.

### 5.2 Actor resolution (the real authority)

`ActorService.resolve(identity)` loads from the database: `profiles` (status), `platform_staff` (kind, permissions, hub_ids, MFA state), `vendor_members` (vendor, role, status). It returns `Actor { profileId, status, contexts[], platform?, memberships[] }`. If the profile row does not exist, call `ensureProfile()` (idempotent create) so login never depends on the webhook alone. Cache with a TTL of at most 15 seconds, **invalidated on any role, status or membership change** so suspensions and removals take effect on the next request. Suspended or deleted profiles get 403 `ACCOUNT_SUSPENDED`.

Active context (customer, vendor X, platform) is chosen by the client with an `X-Dishi-Context` header (for example `customer`, `vendor:<uuid>`, `platform`) and **re-validated against the actor's real memberships on every request**. The header alone grants nothing.

### 5.3 The `@Access` decorator (single source for enforcement and docs)

```
@Access({ public: true })
@Access({ auth: true })                                   // any active signed-in user
@Access({ permission: 'promos.publish' })                 // platform permission (superadmin passes; hub scope applied)
@Access({ superadmin: true })
@Access({ vendorRole: 'manager', vendorParam: 'vid' })    // owner or manager of :vid ('kitchen' = any member, 'owner' = owner only)
@Access({ owner: 'order' })                               // resource owner check via a resolver
@Access({ webhook: 'clerk' | 'mpesa' })                   // signature or secret verified, no actor
+ optional: { stepUp: true }, { mfa: true }
```

It applies the guards **and** `@ApiBearerAuth`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, and adds an `x-access` extension plus a line in the operation description ("Requires: promos.publish"). Swagger therefore shows exactly what the code enforces. Enforcement of vendor routes also checks that the vendor in the path matches an active membership, and platform routes apply **hub scope** to every query.

### 5.4 Step-up and MFA

- Platform staff routes require MFA (`mfa: true`). Sensitive actions (payout approval, payout-detail change, staff removal, fee changes, ownership transfer) use `stepUp: true`: when the session lacks a recent re-verification, return 403 `STEP_UP_REQUIRED` so the client can run Clerk reverification and retry. **Verify the current Clerk mechanism for reading verification age from the session** before implementing.

### 5.5 Invariants (service logic plus DB constraints)

Last active superadmin cannot be removed, demoted or suspended; nobody grants a permission they do not hold; `staff.manage` and `settings.manage` are never stored in a sub-admin's permissions; `audit_log` is insert-only. Privileged operations write their audit row **in the same transaction** through the shared `AuditService`.

## 6. Domain rules to implement (match v2 and the SQL; document in `DOMAIN_RULES.md`)

- **Order state machine:** `PLACED → ACCEPTED → PREPARING → READY → COLLECTED`; `PLACED → REJECTED`; `PLACED/ACCEPTED/PREPARING → CANCELLED`. `POST .../transition` takes `{ from, to, reason?, prepMinutes?, pickupCode? }`, returns 409 `ORDER_STATE_CONFLICT` if the order is no longer in `from`, requires a reason for reject and cancel, requires the pickup code for `COLLECTED`, writes `order_status_events`, emits events after commit.
- **Payment gating (decision, default):** an order is created with `payment_status = pending`; it appears on the KDS only once `paid`; unpaid orders expire after 5 minutes and release their slot capacity.
- **Store state spine:** `vendor_live_state` view plus `vendor_is_orderable(vendor_id, item_ids, slot)` semantics (DASHBOARDS guide section 5.2). `POST /orders/quote` and `POST /orders` **re-validate server-side** and return `ITEM_SOLD_OUT`, `STORE_NOT_ACCEPTING` or `SLOT_FULL`.
- **Pricing:** one `PricingService` computes subtotal, coupon discount, platform fee, vendor net, total (integer KES, rounding rules in `DOMAIN_RULES.md`) with exhaustive unit tests. Quote and place-order use the same code path.
- **Coupons:** validated server-side only (validity window, caps, per-user limit, minimum order, funded-by, vendor scope). The frontend never decides validity.
- **Payments:** idempotent on M-Pesa receipt (unique). Amount and order must match the callback or the payment is flagged `PAYMENT_AMOUNT_MISMATCH` for admin review.
- **Payouts:** batches built from settled orders; platform fee shown separately; approval needs step-up; execution is manual in the pilot (record the M-Pesa reference when marked paid).
- **Deletion:** SMS-confirmed request; anonymise the profile; keep payment and order rows without the name for 7 years; blocked for active vendor owners (unsettled payouts or open store) and for the last superadmin.
- **Promo workflow:** `draft → in_review → approved`; `live` and `expired` are derived from `starts_at` / `ends_at` by a scheduled job and by query-time filtering; only `promos.publish` approves.

## 7. Realtime (replaces Supabase Realtime)

- Socket.IO gateway at `/realtime`. Handshake authenticates with the Clerk token (`auth.token`); anonymous connections may join **public store-state rooms only**.
- **Rooms and access:** `store:{vendorId}` (public live state), `vendor:{vendorId}:orders` (active members only), `order:{orderId}` (order owner or vendor member).
- **Events (payloads carry ids and minimal state, no PII):** `store.state.changed`, `order.created`, `order.updated`, `order.status`, `slot.updated`. Emitted after DB commit from domain events.
- On connect or reconnect the client **refetches over REST** the active set, then applies events, so missed events cannot corrupt state. Document events in `docs/asyncapi.yaml` (Swagger does not cover WebSockets).
- Pilot scale uses the in-process emitter (single instance). Document the Redis adapter step needed before running more than one instance.

## 8. Integrations

- **Clerk webhooks** (`POST /webhooks/clerk`): Svix signature verified, idempotent, upserts `profiles` on `user.created/updated`, anonymises on `user.deleted`.
- **M-Pesa Daraja:** access-token caching, STK Push initiation, callback receiver. Daraja callbacks are **not signed**, so protect the callback with an unguessable secret path segment, an IP allow-list (verify Safaricom's current ranges), and **confirm every callback with an STK Query call before marking a payment paid**. A scheduled job queries payments stuck in `pending`. Sandbox first; production credentials are a separate human gate.
- **SMS** (Africa's Talking): an `SmsService` interface with an Africa's Talking implementation and a console implementation for local development. Used for ready notices, staff invites, deletion confirmation, payout-number-change notices.
- **Storage:** a `StorageService` interface producing **presigned upload URLs** with type and size limits, scoped by purpose (`menu-image`, `store-cover`, `promo-image`). Default S3-compatible; may wrap Supabase Storage during the parallel run (decision).
- **Jobs (`@nestjs/schedule`):** expire unpaid orders; auto-resume paused stores; flip promo live/expired; aggregate `promo_events`; expire invites; delete stale idempotency keys; retention housekeeping. Jobs are idempotent and safe to run twice.

## 9. Endpoint catalog

All paths are under `/api/v1`. Access legend: **PUBLIC**, **AUTH** (any active signed-in user), **OWNER** (owner of the resource), **VND** (active member of vendor `:vid`, any role), **VND-M** (owner or manager), **VND-O** (owner only), **P:`perm`** (platform permission, hub-scoped), **SUPER**, **WH** (webhook, verified). `Idem` = requires `Idempotency-Key`. `Step` = requires step-up.

### System
| Endpoint | Access | Notes |
|---|---|---|
| `GET /health/live`, `GET /health/ready` | PUBLIC | Outside the `/v1` prefix; excluded from throttling |
| `GET /meta/config` | PUBLIC | Maintenance mode, announcement banner, public feature flags, app version |

### Me, account and settings
| Endpoint | Access | Notes |
|---|---|---|
| `GET /me` | AUTH | Actor: profile, contexts, memberships, permissions, MFA state. Replaces `/api/auth/me` |
| `PATCH /me` | AUTH | Display name, hub |
| `PUT /me/mpesa-number` | AUTH | Customer payment number, validated E.164 |
| `POST /me/deletion-requests` | AUTH | Sends SMS code. Rate limited |
| `POST /me/deletion-requests/confirm` | AUTH | Confirms with code |
| `DELETE /me/deletion-requests` | AUTH | Cancel |
| `POST /me/sessions/revoke-all` | AUTH | Calls Clerk |
| `GET /me/notifications`, `POST /me/notifications/read` | AUTH | In-app list and mark-read |
| `GET /settings/me`, `PUT /settings/me` | AUTH | Personal: notifications, appearance, language, KDS preferences stored server-side |
| `GET /settings/platform`, `PUT /settings/platform` | SUPER, Step | Fees, maintenance mode, banner, flags, security policy. Audited |

### Public catalogue
| Endpoint | Access | Notes |
|---|---|---|
| `GET /hubs` | PUBLIC | |
| `GET /vendors` | PUBLIC | Filters: hub, q, cuisine, price, amenities, open_now; `sort=pickup`; cursor. Includes live-state summary |
| `GET /vendors/:vid` | PUBLIC | Public profile plus live state. No private data |
| `GET /vendors/:vid/menu` | PUBLIC | Categories and items with availability |
| `GET /vendors/:vid/slots?date=` | PUBLIC | Slots with remaining capacity |
| `GET /vendors/:vid/live-state` | PUBLIC | Cheap polling fallback |
| `GET /dishes/featured?hub=`, `GET /dishes/:id` | PUBLIC | Discover carousel |
| `GET /collections` | PUBLIC | Valid collection slugs (promo `OPEN_COLLECTION` validation) |
| `GET /promos/banner?hub=` | PUBLIC | Active slides for Discover |
| `POST /promos/events` | PUBLIC, throttled | Batched impression, click, coupon-applied events |
| `POST /feedback` | PUBLIC, throttled | Pilot feedback link |

### Favourites
| Endpoint | Access | Notes |
|---|---|---|
| `GET /me/favorites` | AUTH | |
| `PUT /me/favorites/:dishId`, `DELETE /me/favorites/:dishId` | AUTH | |

### Orders (customer)
| Endpoint | Access | Notes |
|---|---|---|
| `POST /orders/quote` | AUTH | Items, slot, coupon preview, totals, availability |
| `POST /orders` | AUTH, Idem | Single-vendor rule, slot capacity held |
| `GET /orders`, `GET /orders/active` | AUTH | Mine, cursor |
| `GET /orders/:id`, `GET /orders/:id/events` | OWNER | Includes pickup code once accepted |
| `POST /orders/:id/cancel` | OWNER | Allowed before `PREPARING` |

### Payments and coupons
| Endpoint | Access | Notes |
|---|---|---|
| `POST /payments/mpesa/stk-push` | OWNER (of order), Idem | Creates `pending` payment |
| `GET /payments/:id`, `GET /orders/:id/payment` | OWNER | Status polling |
| `POST /webhooks/mpesa/stk-callback/:secret` | WH | Verified, queried, idempotent on receipt |
| `POST /coupons/validate` | AUTH, throttled | Preview only |

### Vendor applications and invites
| Endpoint | Access | Notes |
|---|---|---|
| `POST /vendor-applications`, `GET /vendor-applications/mine` | AUTH | |
| `PATCH /vendor-applications/:id` | OWNER | Respond when `needs_info` |
| `POST /vendor-applications/:id/reapply` | OWNER | After rejection |
| `GET /invites/:token`, `POST /invites/:token/accept` | AUTH, throttled | Signed-in phone must match the invite; token stored hashed |

### Vendor operations (KDS), `/vendors/:vid/ops/...`
| Endpoint | Access | Notes |
|---|---|---|
| `GET /ops/orders?status=active` | VND | Paid orders only |
| `GET /ops/orders/:oid` | VND | Customer display name only |
| `POST /ops/orders/:oid/transition` | VND | State machine, 409 on conflict |
| `GET /ops/slots?date=` | VND | Timeline and capacity |
| `PUT /ops/status` | VND | `open|paused|closed`, `pausedUntil` |
| `GET /ops/sold-out`, `PUT /ops/items/:iid/availability` | VND | `soldOutUntil` optional |
| `GET /ops/live-state` | VND | Same view the public reads, plus queue detail |

### Business (vendor management), `/business/...`
| Endpoint | Access | Notes |
|---|---|---|
| `GET /business/vendors` | AUTH | My businesses and roles |
| `GET /business/vendors/:vid/home` | VND-M | KPIs, onboarding checklist |
| `GET, PATCH /business/vendors/:vid/profile` | VND-M | Name, description, cover, cuisine tags. Triggers cache revalidation of the public profile |
| `GET, PUT /business/vendors/:vid/hours` | VND-M | Hours and closures |
| `GET, PUT /business/vendors/:vid/slots-config` | VND-M | Capacity, lead time, instructions |
| `GET, PUT /business/vendors/:vid/ordering-rules` | VND-M | Default prep time, auto-pause threshold, max active orders |
| `GET /business/vendors/:vid/menu` | VND-M | Categories and items |
| `POST, PATCH, DELETE /business/vendors/:vid/menu/categories[/:cid]` | VND-M | Delete = archive |
| `POST, PATCH, DELETE /business/vendors/:vid/menu/items[/:iid]` | VND-M | Price changes audited |
| `PUT /business/vendors/:vid/menu/reorder` | VND-M | |
| `POST /business/vendors/:vid/menu/items/bulk-availability` | VND-M | |
| `GET /business/vendors/:vid/orders`, `.../orders.csv` | VND-M | CSV export audited |
| `GET /business/vendors/:vid/earnings`, `.../payouts` | VND-M | Fee shown separately |
| `GET /business/vendors/:vid/payout-details` | VND-M | Masked |
| `PUT /business/vendors/:vid/payout-details` | VND-O, Step | SMS to old and new numbers |
| `GET /business/vendors/:vid/reports/sales?groupBy=day|item|slot`, `.../reports/sales.csv` | VND-M | |
| `GET /business/vendors/:vid/team` | VND-M | Members and pending invites |
| `POST /business/vendors/:vid/team/invites` | VND-M | Manager may invite `kitchen` only |
| `DELETE /business/vendors/:vid/team/invites/:id` | VND-M | |
| `PATCH, DELETE /business/vendors/:vid/team/members/:pid` | VND-O (manager: kitchen only) | Takes effect on the next request |
| `GET, POST /business/vendors/:vid/promo-requests`, `GET, DELETE .../:id` | VND-M | Withdraw while draft |
| `POST /business/vendors/:vid/close`, `POST .../transfer-ownership` | VND-O, Step | |
| `POST /uploads/presign` | AUTH | Purpose decides who may upload (vendor member for menu and cover, `promos.manage` for promo images) |

### Admin, `/admin/...` (hub-scoped where a hub scope exists)
| Endpoint | Access | Notes |
|---|---|---|
| `GET /admin/overview` | P:`overview.view` | Range and hub filter; KPIs from SQL views |
| `GET /admin/vendor-applications[/:id]` | P:`vendors.review` | |
| `POST /admin/vendor-applications/:id/approve`, `/reject`, `/request-info` | P:`vendors.review` | Approve creates `vendors` and owner membership, sends SMS. Reject requires reason |
| `GET /admin/vendors[/:id]`, `PATCH /admin/vendors/:id` | P:`vendors.manage` | Fees and hub overrides audited |
| `POST /admin/vendors/:id/suspend`, `/reinstate` | P:`vendors.manage` | Reason required |
| `GET /admin/users[/:id]` | P:`users.view` | Phone masked |
| `POST /admin/users/:id/reveal-phone` | P:`users.view` | Audited |
| `POST /admin/users/:id/suspend`, `/reinstate` | P:`users.manage` | |
| `GET /admin/deletion-requests`, `POST /admin/deletion-requests/:id/process` | P:`users.manage` | |
| `GET /admin/orders[/:id]` | P:`orders.view` | |
| `POST /admin/orders/:id/cancel`, `/flag-refund` | P:`orders.support` | Reason required |
| `GET /admin/payments[/:id]`, `GET /admin/payments/unmatched` | P:`payments.view` | |
| `POST /admin/payments/:id/query-status`, `/reconcile` | P:`payouts.manage` | Calls Daraja query |
| `GET /admin/payout-batches[/:id]`, `.../csv` | P:`payments.view` | |
| `POST /admin/payout-batches` | P:`payouts.manage` | Build from period |
| `POST /admin/payout-batches/:id/approve`, `/mark-paid` | P:`payouts.manage`, Step | `mark-paid` records the M-Pesa reference |
| `GET, POST /admin/promos`, `GET, PATCH /admin/promos/:id` | P:`promos.manage` | |
| `POST /admin/promos/:id/submit`, `/duplicate`, `/archive` | P:`promos.manage` | |
| `POST /admin/promos/:id/approve`, `/reject` | P:`promos.publish` | Reason on reject |
| `PUT /admin/promos/reorder`, `GET /admin/promos/:id/analytics` | P:`promos.manage` | |
| `GET /admin/promo-requests`, `POST .../:id/approve`, `/reject` | P:`promos.manage` (approve: `promos.publish`) | Approve creates a slide labelled Sponsored |
| `GET, POST /admin/coupons`, `PATCH /admin/coupons/:id`, `POST .../:id/deactivate`, `GET .../:id/redemptions` | P:`coupons.manage` | |
| `POST, PATCH, DELETE /admin/hubs[/:id]` | P:`hubs.manage` | Delete = archive |
| `GET /admin/staff`, `GET /admin/staff/presets`, `GET /admin/staff/:pid/effective-permissions` | SUPER | |
| `POST /admin/staff/invites`, `PATCH /admin/staff/:pid`, `POST .../:pid/suspend` | SUPER | Escalation and last-superadmin rules enforced |
| `DELETE /admin/staff/:pid` | SUPER, Step | |
| `GET /admin/audit`, `GET /admin/audit.csv` | P:`audit.view` | Read-only; CSV export itself audited |

### Webhooks
| Endpoint | Access | Notes |
|---|---|---|
| `POST /webhooks/clerk` | WH (Svix) | Idempotent |
| `POST /webhooks/mpesa/stk-callback/:secret` | WH | See Payments |
| `POST /webhooks/sms/delivery` | WH (optional) | Delivery reports |

Realtime events are specified in `docs/asyncapi.yaml` (section 7). **No dev-only or bypass endpoints exist in the API.**

## 10. Swagger (OpenAPI): documentation and testing

### 10.1 Setup

- `@nestjs/swagger` with the CLI plugin enabled in `nest-cli.json` to infer DTO properties. `DocumentBuilder`: title, version, description, bearer scheme named `clerk-jwt`, the `X-Dishi-Context` header and the `Idempotency-Key` header as documented parameters, tags per module in a deliberate order.
- UI at `/api/docs`, JSON at `/api/docs-json`. Enabled by `SWAGGER_ENABLED=true` (on in development and staging). In production it is **off or behind basic auth**. The app refuses to start in production with Swagger enabled and no basic-auth credentials.
- `openapi/dishi.openapi.json` is exported on every build and **committed**. CI fails if the generated spec differs from the snapshot without the snapshot being updated, and runs a breaking-change diff (for example `oasdiff`) against the main branch.

### 10.2 Quality bar for every operation

`@ApiOperation` summary and description; `@Access` (adds the lock icon, 401 and 403 responses and `x-access`); typed request DTO with `@ApiProperty` **realistic examples** (KES amounts, `+2547...` phones, real-looking UUIDs, Nairobi times) so "Try it out" works without editing; typed success response; documented error responses using the problem schema with the `code`s that operation can return (400, 401, 403, 404, 409, 422, 429 as applicable); `Idempotency-Key` documented where required. No `any`, no unnamed inline schemas. Schema names are meaningful and unique.

### 10.3 Getting a token into Swagger

Clerk session tokens are short-lived (about a minute), so a pasted token goes stale quickly. In order of preference (**verify each against current Clerk docs**):
1. In the **Development** Clerk instance only, create a long-lived JWT template (for example `swagger-dev`, one hour) and expose a **dev-only** page in the Next app (`/dev/token`, 404 in production) that shows a token for the signed-in user with a copy button. Paste it into Swagger's **Authorize** dialog.
2. `scripts/dev-token` that prints a token for a named seeded user, if Clerk's backend API allows minting one in the dev instance.
3. For CI e2e only: tests override the token-verifier provider with a local test JWKS so Nest can be tested without a network call. This is acceptable **only** at that seam, and there must still be one real-Clerk smoke test in staging.

Seed one Clerk dev user per actor (customer, kitchen, manager, owner, each sub-admin preset, superadmin) mapped to rows in `supabase/seed.sql`. Never build an auth bypass, header trust or "dev user" shortcut into the API.

### 10.4 Testing through Swagger (three layers; do all three)

1. **Automated Swagger smoke runner** (`test/openapi-smoke/`): load `/api/docs-json`; for every operation, using the spec's own `example` values (exactly what "Try it out" sends), call it as an **allowed actor** and as a **denied actor** (read from `x-access`), then assert: status code is one the spec documents, response body validates against the spec's schema (ajv), allowed actor gets 2xx on the happy path, denied actor gets 401 or 403, and mutations clean up or run in a disposable schema. The run fails if any operation is skipped without an explicit, justified entry in `test/openapi-smoke/skip.json`.
2. **Property fuzzing** in CI against the test database: Schemathesis (or equivalent) over the spec for 5xx detection and schema conformance.
3. **Human walkthrough**: write `docs/agent/SWAGGER_WALKTHROUGH.md`, an ordered click-through anyone can follow in `/api/docs`, with the expected status for each step, and record the observed result: (a) Authorize as customer → `GET /me` → `GET /vendors` → `GET /vendors/:vid/menu` → `POST /orders/quote` → `POST /orders` → `POST /payments/mpesa/stk-push` (sandbox) → `GET /orders/:id`; (b) as kitchen → `GET /vendors/:vid/ops/orders` → transition through to `COLLECTED`, then confirm `/business/...` returns 403; (c) as owner → menu change, team invite, earnings; (d) as superadmin → approve a vendor application, create a sub-admin; (e) as Promo Manager → create, submit and approve a promo, then confirm `/admin/payouts` returns 403. Add one headless browser test that opens `/api/docs`, confirms the UI renders and the Authorize dialog accepts a token.

### 10.5 Coverage gate

A test enumerates every registered Nest route and fails unless each route: appears in the OpenAPI spec, has `@Access`, appears in `docs/agent/ENDPOINTS.md`, has at least one passing e2e test, and (when protected) at least one passing deny test for an actor who must not get in. The deny matrix is **generated from `x-access`** across all actors, the same idea as the frontend authz matrix.

## 11. Testing strategy

- **Unit:** services with mocked repositories, especially `PricingService`, the order state machine, coupon rules, invite rules, privilege-escalation rules.
- **Integration and e2e (supertest):** against a real PostgreSQL (Testcontainers or a service container) with `supabase/migrations/*.sql` applied and the seed loaded. No mocked database.
- **Concurrency tests:** double transition (two requests, one wins, one 409); two customers taking the last slot; same `Idempotency-Key` sent twice and with a different body; duplicate Daraja callback.
- **Webhook tests:** signed Clerk fixtures (valid, invalid, replayed); Daraja callback fixtures including amount mismatch, unknown checkout id, duplicate receipt, and a callback that fails the STK Query confirmation.
- **Realtime tests:** two socket clients; vendor receives `order.created`; customer receives `order.status`; a client without access to a room receives nothing; reconnect refetch.
- **Authz matrix:** generated from `x-access` (actor × route).
- **Load smoke** (k6 or autocannon, documented in `docs/agent/PERF.md`): order placement and KDS fan-out at the expected pilot scale (assume about 50 concurrent orders and 20 connected KDS tablets unless told otherwise).
- CI: lint, typecheck, unit, e2e, OpenAPI export and snapshot diff, smoke runner, Docker build.

## 12. Build phases and gates

| Phase | Work | Exit gate |
|---|---|---|
| **N0** | Discovery and contract extraction (section 2) | `ENDPOINTS.md`, `API_CONTRACT_MAP.md`, `SQL_RULES_MAP.md` complete; every data-layer function mapped |
| **N1** | Scaffold: config validation, logging, health, error filter, validation pipe, Swagger with snapshot, Prisma introspection, Docker, CI | `/health/ready` green; `/api/docs` renders; snapshot test works |
| **N2** | Auth: Clerk guard, `ActorService`, `@Access`, `ensureProfile`, `/me`, Clerk webhook, authz matrix generator, audit service | Real-Clerk smoke passes in staging; matrix runs; suspended user blocked on next request |
| **N3** | Catalogue and store state: hubs, vendors, menu, slots, live state, featured dishes, collections, `/meta/config` | Public endpoints match the current data-layer outputs (parity checks) |
| **N4** | Vendor applications, invites, business profile, hours, slots, ordering rules, menu CRUD, team, uploads | Owner and manager flows pass e2e; menu edit reflected on public profile |
| **N5** | Orders and KDS: quote, place order (idempotent), transitions, events, realtime gateway, pickup code, expiry job | Two-client realtime test; concurrency tests green |
| **N6** | Payments: Daraja STK, callback, query confirmation, reconciliation, expiry; coupons | Sandbox end-to-end: order → STK → callback → paid → appears on KDS |
| **N7** | Promos, promo requests, coupons admin, promo events and analytics, favourites, notifications, settings endpoints | Promo workflow e2e; banner endpoint feeds Discover |
| **N8** | Admin: overview KPIs, applications, vendors, users, orders support, payments and payouts, hubs, staff, audit, platform settings | Full vendor lifecycle through API with audit rows; sub-admin deny tests |
| **N9** | Swagger hardening: smoke runner over 100% of operations, fuzzing, walkthrough executed, coverage gate, AsyncAPI | Section 10.4 and 10.5 all green with evidence |
| **N10** | Cutover and decommission (section 13), load smoke, security review, docs | Per-module flags flipped, rollback tested |

N0 and N1 must finish before anything else. N5 depends on N3 and N4. Do not start N6 before the Daraja sandbox gate is cleared.

## 13. Cutover from Supabase to Nest (strangler pattern)

1. **Adapter seam.** `src/lib/data/*` already isolates Supabase. Add Nest implementations next to them using a client **generated from the OpenAPI spec** (`openapi-typescript` plus `openapi-fetch`). A per-module flag `DATA_BACKEND_<MODULE>=supabase|nest` selects the implementation. Server components and server actions call Nest with the user's Clerk token; browsers call Nest directly only for realtime and presigned uploads. This keeps CORS surface small.
2. **Parity suite.** One contract test suite for each data-layer module runs against **both** adapters on the same database and must produce equal results (ignoring ordering where unspecified).
3. **Shadow reads.** For read endpoints, run Nest in shadow mode first: call both, return Supabase's result, log differences. Fix differences before flipping.
4. **Cut order** (each step is a flag flip with its own soak period): public catalogue → me and settings → orders and KDS **together with** the realtime switch (`useRealtime` moves to Socket.IO) → payments → promos and admin.
5. **Storage.** Switch uploads to presigned URLs and run a one-off script copying existing objects, then update stored URLs.
6. **Compatibility.** During the whole parallel run, migrations are additive-only so both backends work on the same schema, and either can be switched back.
7. **Rollback.** Flip the flag back. Document it in `docs/agent/CUTOVER_RUNBOOK.md` and rehearse it once in staging.
8. **Decommission** only after two stable weeks: remove Supabase client code, RLS dependence, Realtime and Storage usage. Whether Postgres stays hosted on Supabase or moves is a separate logged decision.

## 14. Human gates and decisions (ask once, in one short list, keep working on unblocked items)

**Gates:** Clerk keys and webhook secret (dev, staging, prod); database connection strings (dev and pilot, with a `dishi_api` role created); Daraja sandbox credentials and a public callback URL (tunnel or deployed staging); Africa's Talking sandbox credentials; hosting target for the API and its region (Kenya users: latency matters); an S3-compatible bucket or approval to keep Supabase Storage during the parallel run.

**Decisions (log with your recommended default):** ORM (default Prisma); repo layout (default `api/` folder); payment gating and 5-minute order expiry; hosting; whether browsers may call Nest directly beyond realtime and uploads (default no); Redis and BullMQ timing (default after pilot); who may see unmasked phones; coupon stacking (default no stacking); order cancellation window for customers.

## 15. Definition of done (per endpoint) and report format

An endpoint is done only when: it is in the catalog and the OpenAPI snapshot; it has `@Access`; its DTOs, examples and error codes are documented; business logic lives in a service inside a transaction where state changes; allow and deny e2e tests pass; sensitive actions write audit rows; no PII appears in logs; the Swagger smoke runner exercises it; and the evidence is ticked in `PROGRESS.md`.

**Report after every phase and session:** 1. Done (files, one line each) 2. Verified (how, with evidence) 3. Not verified or blocked (why) 4. Needed from me 5. Next step.
