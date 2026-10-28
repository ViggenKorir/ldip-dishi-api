# Dishi API

NestJS backend for Dishi, a mobile-first Nairobi lunch pre-ordering app. This
API is the server-side application layer for the web client; PostgreSQL is
hosted by Supabase, authentication is verified through Supabase Auth, and the
menu/catalogue is read from Prisma models.

> **Implementation status:** the current runnable slice is the public vendor
> and dish catalogue, Supabase profile synchronization, profile read, health
> endpoints, and Swagger/OpenAPI. Orders, payment processing, vendor
> operations, admin dashboards, and the production migration from the old
> library database are not implemented. This README describes the checked-in
> state, not the full product roadmap.

## Stack

| Area | Technology |
|---|---|
| API | NestJS 11, TypeScript |
| Database | PostgreSQL on Supabase |
| ORM/client | Prisma 7 with `@prisma/adapter-pg`; generated client at `prisma/generated` |
| Identity | Supabase Auth (verified server-side with Supabase JS) |
| API contract | Nest Swagger/OpenAPI; snapshot at `openapi/dishi.openapi.json` |
| Validation | `class-validator`, `class-transformer`, Nest `ValidationPipe` |
| Tests | Jest, ts-jest, Supertest |
| Package manager | pnpm 10.17.1, pinned in `package.json` and GitHub Actions |
| CI database | PostgreSQL 16 GitHub Actions service container |

Money fields in the Dishi Prisma schema use whole Kenyan shillings (`Int`).
Database timestamps are UTC; display formatting belongs at the API/client
boundary. Phone identities are supplied and verified by Supabase Auth.

## Current API surface

| Method | Path | Purpose | Access |
|---|---|---|---|
| `GET` | `/health/live` | Process liveness | Public |
| `GET` | `/health/ready` | Cheap database readiness check (`SELECT 1`) | Public |
| `POST` | `/auth/sync` | Upsert the verified Supabase identity into Dishi's `User` table | Supabase bearer token |
| `GET` | `/me` | Read the signed-in user's Dishi profile | Supabase bearer token |
| `GET` | `/vendors` | List active vendors with menus and optional filters | Public |
| `GET` | `/vendors/:id` | Vendor profile and active menu | Public |
| `GET` | `/dishes/featured` | Available featured dishes with vendor data | Public |
| `GET` | `/dishes/:id` | Dish and its vendor | Public |

`GET /vendors` accepts `q` (vendor, area, or dish-name search), `cuisine`,
`openNow`, `maxPickupMin`, and `sort=pickup|price`. The service maps Prisma
rows into the frontend's existing `Vendor` / `Dish` shape, computes
`priceRange` from available dishes (falling back to all active dishes if all
are sold out), derives pickup display time from prep minutes, orders categories
by `sortOrder`, hides non-active vendors and dishes, and excludes sold-out
dishes and closed vendors from the featured list.

Swagger UI is served at `/api` and Nest's generated JSON is available at
`/api-json`. The separate OpenAPI helper defines `/api/docs` and
`/api/docs-json`, but the current `main.ts` does not mount that helper. The
committed snapshot is regenerated with `pnpm openapi:export`; CI checks that
export does not leave a diff.

## How authentication works

1. Supabase Auth handles phone OTP and configured social sign-in. Credentials
   and provider secrets are not handled by this API.
2. The client sends its Supabase access token as a bearer token to a protected
   route.
3. `SupabaseGuard` validates the token using `supabase.auth.getUser()`. Missing,
   malformed, invalid, or expired tokens receive 401. Missing server-side
   Supabase configuration receives 503.
4. `POST /auth/sync` upserts `User` with the Supabase UUID as `User.id`. On
   first login it maps provider, email/phone, display name and avatar metadata
   and creates default `UserSettings` in the same Prisma upsert. Subsequent
   syncs update only `lastLoginAt`, preserving profile edits.
5. `GET /me` reads the matching database profile and returns 404 if the user
   has not synchronized yet.

Google metadata accepts `name`/`full_name` and `picture`/`avatar_url`; Apple
metadata accepts `full_name` and `avatar_url`. The actual metadata provided by
an identity provider can vary, so clients should not depend on every provider
returning an avatar or display name.

**Authorization is currently authentication-only** for `/me` and `/auth/sync`.
Role-aware permissions, vendor membership checks, and admin authorization are
not yet implemented.

## Database schema and migration decisions

`prisma/schema.prisma` is the intended Dishi schema. It defines:

- Geography and identity: `Hub`, `User`, `UserSettings`, `DeletionRequest`
- Vendors and catalogue: `Vendor`, `VendorMember`, `VendorHours`, `Cuisine`,
  `Amenity`, `MenuCategory`, `Dish`
- Ordering and money: `PickupSlot`, `Order`, `OrderItem`, `Payment`, `Payout`
- Engagement and content: `PromoBanner`, `FavoriteVendor`, `FavoriteDish`,
  `Notification`

The schema encodes important data rules such as Supabase UUID identity,
integer-KES amounts, order-item price/name snapshots, and preserving orders
when a user is deleted by setting `Order.userId` to null.

The checked-in four-migration history predates Dishi and creates the old
library `User`, `Bookmark`, and `Project` tables. **Those migration files are
retained as immutable history.** We have not established whether they are
applied to any live database or whether their tables contain data. No Dishi
baseline or Dishi schema migration has been applied to a real database.

The selected working direction is a forward migration after database state and
data impact are known. A clean-slate baseline may be safer only if inspection
shows it is appropriate. Neither path authorizes deleting old data now.

Migration safety rules:

- Generate migrations only against a throwaway or staging database.
- Review generated SQL and data impact before applying it.
- Never edit or remove an applied migration; use a forward fix.
- Production uses `prisma migrate deploy`, never `migrate dev`.
- Before any real-database migration, identify the host and database, show the
  reviewed SQL, and confirm backup/PITR availability and approval.
- Do not alter Supabase-managed `auth` or `storage` schemas. RLS stays as-is;
  enabling or changing RLS requires explicit approval.

See [`prisma/migrations/README.md`](prisma/migrations/README.md) for naming and
rollback guidance.

### Connection-string separation

| Variable | Use | Required target |
|---|---|---|
| `DATABASE_URL` | Running API only | Supabase pooler, normally port 6543 |
| `DIRECT_URL` | Prisma migrations and seed | Direct PostgreSQL connection, normally port 5432 |
| `SUPABASE_URL` | Server-side Auth token verification | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin client only | Never expose to browser or `NEXT_PUBLIC_*` |
| `FRONTEND_URL` | API CORS allow-list | Exact production web origin |

Do not paste connection strings or keys into source, CI output, logs, or this
documentation. `.env*` is gitignored (except the example template).

## Seed data

`prisma/seed/mock-vendors.ts` holds the frontend's eight demonstration vendors.
`prisma/seed/seed.ts` currently seeds reference rows and the demo vendors,
categories, dishes, and starter banner with stable-ID upserts. The configured
Prisma seed command is `tsx prisma/seed/seed.ts`.

**Known unfinished safety work:** seeding is not yet split into
`seed:reference` and `seed:demo`; there is no production guard for demo data,
no per-vendor transaction, and the current seed adapter falls back from
`DIRECT_URL` to `DATABASE_URL` if the direct URL is missing. Do not run this
demo seed against production. The seed has not been verified twice against a
test database, and a row-count idempotency test is not present.

Gibcon Restaurant is not present in the mock menu. Its actual menu, KES prices,
categories, and hours must be supplied before adding a real-vendor seed.

## Local development

Use Node.js 20 or newer and the repository-pinned pnpm version. Keep local
environment values in an ignored `.env`; do not commit real credentials.

```sh
corepack enable
pnpm install --frozen-lockfile
DIRECT_URL='postgresql://localhost:5432/dishi' pnpm build
pnpm start:dev
```

`pnpm build` runs `prisma generate` before Nest compilation. Prisma's config
requires `DIRECT_URL` to be set, but client generation does not connect to the
database, so the placeholder above is sufficient for a local build. Running
migrations requires a throwaway local or staging PostgreSQL target and a
deliberate review. For a configured database:

```sh
pnpm prisma migrate status
pnpm prisma migrate deploy
```

The app constructs Prisma with `DATABASE_URL`; migration configuration uses
`DIRECT_URL`. At startup Nest listens on `0.0.0.0:$PORT` (default port 3001).
Configure `FRONTEND_URL` to the exact frontend origin; localhost:3000 is also
allowed for development.

See [`SETUP.md`](SETUP.md) for the existing setup notes. Review these notes
against the current workflow before copying any historical commands: legacy
instructions may describe the old schema or migration flow.

## Tests and CI

Current commands:

```sh
pnpm lint --max-warnings=0
pnpm build
pnpm test
pnpm test:e2e
pnpm test:cov
pnpm openapi:export
```

Unit tests cover:

- First Supabase login creates a Dishi user and default settings.
- Google and Apple identity metadata mapping.
- Subsequent sync updates only `lastLoginAt`.
- Missing/malformed, invalid, and expired Supabase tokens are rejected.
- A valid token attaches the verified database identity to the request.

E2E tests cover liveness, readiness response shape, unauthorized access to
`/me` and `/auth/sync`, and the OpenAPI snapshot/security scheme. These tests
do not yet exercise vendor catalogue filtering against a seeded real
PostgreSQL database.

`.github/workflows/ci.yml` pins pnpm, installs from the frozen lockfile,
generates Prisma, starts PostgreSQL 16, runs migrations, lint, build, OpenAPI
snapshot verification, unit tests, and e2e tests. CI deploy is not configured.
The current coverage command exists, but there is no 80% coverage threshold.
The test database and migrations still need to be reconciled with the Dishi
schema before CI can prove a complete clean-clone Dishi database setup.

Most recently verified locally:

- Frozen pnpm install succeeded with pnpm 10.17.1.
- Prisma client generation succeeded.
- Lint and production build succeeded.
- Unit tests: 11 passed.
- E2E tests: 5 passed.
- OpenAPI export produced no snapshot diff.

## Deployment status and decisions

The API is structured for Render: `start:prod` runs `node dist/src/main`, and
the listener binds `0.0.0.0` and `$PORT`. Health endpoints are available for
liveness and database readiness. The current build is verified locally; a
Render service, pre-deploy migration, environment dashboard, and production
smoke test are not verified here.

Use `pnpm build` for Render's build command. It generates
`prisma/generated/client` before running Nest's compiler, so this ignored
generated directory does not need to be committed. Set `DIRECT_URL` in the
Render environment before the build: Prisma config requires the variable even
though client generation itself does not connect to the database. Keep the
pre-deploy `pnpm prisma migrate deploy` step separate from the build.

The intended production connection setup is:

- Render API: pooler URL in `DATABASE_URL`, direct URL in `DIRECT_URL`,
  server-only Supabase service-role key, exact `FRONTEND_URL`.
- Web client: public Supabase URL/anon key and Render API URL only; never the
  service-role key or database URLs.
- Render free instances can sleep and have a cold start; assess a paid instance
  before a lunch pilot.

Key implementation decisions and reasons:

| Decision | Reason |
|---|---|
| Supabase UUID is the Dishi user primary key | One stable identity across OTP, Google, and Apple sign-in; no duplicate API identity |
| Prisma client generated into ignored `prisma/generated/` | Avoid committing generated output and ensure it matches the current schema |
| Runtime uses pooler; migrations/seeding use direct URL | Avoid migration/prepared-statement issues through the pooler |
| Preserve old migration files and database history | Deleting history or tables without live-state and data-impact evidence is unsafe |
| Remove old bookmark/project API code | Those endpoints referenced models absent from the Dishi schema; Dishi favorites are represented by `FavoriteVendor` and `FavoriteDish` |
| Keep health probes cheap and distinct | Liveness needs no database; readiness executes only `SELECT 1` |
| Pin pnpm in both package metadata and workflow | Fixes GitHub's “No pnpm version is specified” setup failure and makes installs reproducible |

## Not implemented yet

- Dishi schema migration/baseline verified against empty and staging-copy
  databases; status and legacy data inspection
- Safe split reference/demo seed commands, demo-seed production guard,
  per-vendor transactions, and idempotency proof
- Full catalogue e2e coverage for all filters, sorting, frontend response
  contracts, missing resources, and seeded demo data
- Order placement, snapshots/totals, legal status transitions, vendor scoping,
  pickup-slot capacity and concurrency controls
- M-Pesa STK Push, callback verification/idempotency/reconciliation
- Account deletion/anonymization workflows and payout processing
- Role/permission authorization and vendor operations/KDS
- CI coverage threshold and a deployment job gated on green CI
- Render/Vercel live deployment, production CORS/auth smoke checks, and
  release backup/PITR confirmation

Do not treat the current catalogue/auth slice as production-ready for orders or
payments. Add implementation and regression tests before enabling those flows.
