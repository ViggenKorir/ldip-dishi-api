# Dishi API

NestJS and Prisma backend for the Dishi application.

This repository currently provides:

- A NestJS HTTP API.
- PostgreSQL persistence through Prisma 7 and the PostgreSQL adapter.
- JWT-based signup and signin endpoints.
- Bookmark CRUD endpoints.
- Read-only project endpoints used by the Dishi dashboard.
- Docker Compose configuration for a local PostgreSQL database.

The backend listens on `http://localhost:4000` by default.

## Repository layout

```text
Dishi-api/
├── prisma/
│   ├── migrations/                 Database migrations
│   ├── seed/seed.ts                Development seed data
│   ├── schema.prisma               Database models and enums
│   └── generated/                  Generated Prisma client
├── src/
│   ├── auth/                       Signup, signin, JWT strategy and guards
│   ├── bookmark/                   Bookmark controller and service
│   ├── project/                    Dashboard project controller and service
│   ├── prisma/                     Shared Prisma service/module
│   ├── supabase/                   Supabase integration
│   ├── user/                       Authenticated user endpoints
│   ├── app.module.ts               Root Nest module
│   └── main.ts                     HTTP bootstrap, validation and CORS
├── docker-compose.yml              Local PostgreSQL service
├── dockerfile                      Container build definition
├── package.json                    Scripts and dependencies
└── .env                            Local environment values
```

## Prerequisites

Install the following before starting:

- Node.js compatible with the versions used by the project dependencies.
- npm.
- Docker Desktop or Docker Engine with Docker Compose.
- Git.

The frontend is in the sibling directory:

```text
/home/korir/Desktop/dishi/dishi-app
```

## Environment configuration

Create or update `.env` in this repository. Do not commit real secrets.

```dotenv
DATABASE_URL="postgresql://root:root123@localhost:5432/nest?schema=public"
JWT_SECRET="replace-with-a-long-development-secret"
SUPABASE_URL="your-supabase-url"
SUPABASE_PUBLIC_KEY="your-supabase-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

The checked-in development configuration uses the PostgreSQL container defined
in `docker-compose.yml`. Replace all placeholder and development secrets before
sharing the repository or deploying it.

## Install dependencies

From the backend directory:

```bash
cd /home/korir/Desktop/dishi/Dishi-api
npm install
```

Generate the Prisma client after installing dependencies or changing
`prisma/schema.prisma`:

```bash
npx prisma generate
```

The generated client is written to `prisma/generated`, which is the import
path used by the application.

## Start PostgreSQL with Docker

Start the local database:

```bash
npm run db:dev:up
```

Check that the database container is running:

```bash
docker compose ps
```

The database is exposed on `localhost:5432` with:

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `nest` |
| User | `root` |
| Password | `root123` |

The data is stored in the Docker volume `nest_db_data`. To remove the local
database and its data:

```bash
npm run db:dev:rm
```

Do not run the removal command if you need to preserve local data.

## Apply migrations and seed the database

Apply all committed migrations:

```bash
npm run prisma:dev:deploy
```

The current project migration is:

```text
prisma/migrations/20261021223400_add_projects/migration.sql
```

It creates:

- The `ProjectStatus` PostgreSQL enum with `active`, `paused`, and `done`.
- The `Project` table with `id`, `name`, `description`, `status`,
  `updatedAt`, and `createdAt`.

Seed the development database:

```bash
npx prisma db seed
```

The seed script clears existing projects, bookmarks, and users, then creates:

- Two sample users.
- Four sample bookmarks.
- Four dashboard projects:
  - Website redesign (`active`)
  - Mobile app (`active`)
  - Billing migration (`paused`)
  - Onboarding emails (`done`)

The seed script is destructive for the configured database. Use it only for a
development database unless you intentionally want to delete existing records.

For a clean local database, run:

```bash
npm run db:dev:rm
npm run db:dev:up
npm run prisma:dev:deploy
npx prisma db seed
```

## Run the backend

Development mode:

```bash
npm run start:dev
```

Other available modes:

```bash
npm run start       # Start the compiled application
npm run start:prod  # Start dist/src/main
npm run start:debug # Start Nest with the Node debugger
```

The API should report a URL similar to:

```text
Application is running on: http://127.0.0.1:4000
```

Verify that Nest is responding:

```bash
curl http://localhost:4000
```

Expected response:

```json
{"message":"Server is running..."}
```

## Project API

The project API was added for the dashboard already present in
`dishi-app/src/app/(app)/dashboard`.

### `GET /projects`

Returns all projects ordered by `updatedAt` descending.

Example:

```bash
curl http://localhost:4000/projects
```

Example response:

```json
[
  {
    "id": "uuid",
    "name": "Website redesign",
    "description": "Refresh the marketing site with the new brand.",
    "status": "active",
    "updatedAt": "2026-09-28T10:00:00.000Z",
    "createdAt": "2026-10-21T20:00:00.000Z"
  }
]
```

### `GET /projects/:id`

Returns one project by UUID.

```bash
curl http://localhost:4000/projects/<project-id>
```

If the ID does not exist, Nest returns a `404` response with a message similar
to:

```json
{
  "statusCode": 404,
  "message": "The requested project was not found.",
  "error": "Not Found"
}
```

### Project implementation

- `src/project/project.controller.ts` exposes `GET /projects` and
  `GET /projects/:id`.
- `src/project/project.service.ts` queries Prisma and translates missing
  records into `NotFoundException`.
- `src/project/project.module.ts` packages the controller and service.
- `src/app.module.ts` imports `ProjectModule`.

The project endpoints are currently read-only. No project create, update, or
delete endpoint has been added.

## Other API areas

### Authentication

The backend currently exposes:

```text
POST /auth/signup
POST /auth/signin
```

Signin returns a JWT access token:

```bash
curl -X POST http://localhost:4000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"your-password"}'
```

The JWT must be sent to guarded endpoints using:

```text
Authorization: Bearer <access_token>
```

### Bookmarks

The bookmark controller exposes:

```text
GET    /bookmarks
GET    /bookmarks/:id
POST   /bookmarks
PATCH  /bookmarks/:id
DELETE /bookmarks/:id
```

Bookmark creation currently expects `title`, `description`, `link`, and
`userId`. The `link` must be a valid URL.

## Step-by-step frontend integration

The frontend uses RTK Query. Its project API is already defined in:

```text
dishi-app/src/store/api/projectsApi.ts
```

That file requests `/projects` and `/projects/:id`. The base URL is read from
`NEXT_PUBLIC_API_URL` in:

```text
dishi-app/src/lib/env.ts
```

### 1. Start and verify the database

From the backend directory:

```bash
npm install
npm run db:dev:up
npm run prisma:dev:deploy
npx prisma db seed
```

Verify the seeded API:

```bash
curl http://localhost:4000/projects
```

### 2. Start the backend

In one terminal:

```bash
cd /home/korir/Desktop/dishi/Dishi-api
npm run start:dev
```

Keep this process running.

### 3. Configure the frontend API URL

Create or update:

```text
/home/korir/Desktop/dishi/dishi-app/.env.local
```

Add:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

`NEXT_PUBLIC_API_URL` is embedded into the browser bundle, so it must contain
only a public URL and never a secret.

### 4. Restart the frontend after changing `.env.local`

Environment variables are loaded when Next.js starts. Stop and restart the
frontend after editing `.env.local`:

```bash
cd /home/korir/Desktop/dishi/dishi-app
npm install
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

The dashboard's `ProjectStats` and `ProjectList` components share the RTK
Query `getProjects` request. The project detail route uses
`GET /projects/:id`.

### 5. Confirm the browser request

In browser developer tools:

1. Open the **Network** tab.
2. Visit `/dashboard`.
3. Confirm a request is sent to `http://localhost:4000/projects`.
4. Confirm the response status is `200`.
5. Confirm the response contains objects with `id`, `name`, `description`,
   `status`, and `updatedAt`.

### 6. Authentication integration status

The frontend login flow currently uses Clerk, while this backend exposes its
own JWT signin endpoint. Project endpoints are currently public, so the
dashboard project request does not require a token.

If project data should be user-specific or protected, complete these changes
before production use:

1. Add `JwtGuard` to the project controller or selected project routes.
2. Read the authenticated user with the existing `GetUser` decorator.
3. Add ownership or workspace filtering in `ProjectService`.
4. Add a frontend token provider or replace the Clerk session flow with the
   backend JWT flow.
5. Attach the token in RTK Query's `prepareHeaders`.
6. Add authenticated API tests.

Do not treat a UI auth guard as backend security. Every protected backend
route must enforce authorization independently.

## CORS and local networking

The backend enables CORS in `src/main.ts`. For a browser request from
`http://localhost:3000`, the backend must return a compatible
`Access-Control-Allow-Origin` value.

The current configuration uses a wildcard origin together with credentials.
Browsers reject wildcard origins for credentialed requests. If cross-origin
requests fail with a CORS error, change the backend configuration to an
explicit frontend origin, for example:

```ts
app.enableCors({
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
});
```

Use the deployed frontend origin instead of `http://localhost:3000` in
staging or production.

## Tests and validation

### Backend build

```bash
npm run build
```

This compiles the Nest application into `dist`.

### Backend unit tests

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:cov
```

End-to-end tests:

```bash
npm run test:e2e
```

### Prisma validation

```bash
npx prisma validate
npx prisma generate
```

### Frontend checks

From `dishi-app`:

```bash
npm run typecheck
npm test -- --run
npm run build
```

The frontend project tests use Vitest. The dashboard statistics tests verify
that active, paused, and completed projects are counted correctly.

## Debugging guide

### API does not start

Check:

```bash
docker compose ps
node --version
npm --version
```

Then check that `DATABASE_URL` is available and that PostgreSQL is accepting
connections:

```bash
docker compose logs nest-db
```

If dependencies or generated Prisma types are missing:

```bash
npm install
npx prisma generate
npm run build
```

### Prisma cannot connect to PostgreSQL

Confirm that:

1. The database container is running.
2. Port `5432` is not already occupied by another PostgreSQL instance.
3. `DATABASE_URL` uses `localhost` when the API runs on the host.
4. `DATABASE_URL` uses `nest-db` only when the API runs inside Docker Compose.
5. The database name, user, and password match `docker-compose.yml`.

Inspect the container:

```bash
docker compose ps
docker compose logs nest-db
```

### Migration errors

Check migration status:

```bash
npx prisma migrate status
```

Apply committed migrations:

```bash
npm run prisma:dev:deploy
```

For a disposable local database, remove and recreate the volume, then apply
the migrations again. Do not reset a shared or production database.

### The API returns an empty project list

Run the seed command:

```bash
npx prisma db seed
```

Then verify the API directly:

```bash
curl -i http://localhost:4000/projects
```

If the API returns data but the dashboard does not, inspect
`NEXT_PUBLIC_API_URL`, restart Next.js, and check the browser Network and
Console tabs.

### Frontend reports `Failed to fetch` or CORS errors

Check:

1. The backend is running on port `4000`.
2. The frontend URL is `http://localhost:3000`.
3. `.env.local` contains `NEXT_PUBLIC_API_URL=http://localhost:4000`.
4. Next.js was restarted after changing `.env.local`.
5. Backend CORS uses an explicit origin when credentials are enabled.

### Frontend still displays mock data

The frontend falls back to `/api` when `NEXT_PUBLIC_API_URL` is missing. Set
the variable explicitly:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Restart the frontend and verify the request URL in browser developer tools.

### Authentication failures

Remember that the backend route is `/auth/signin`, not `/auth/login`.
Signin returns `{ "access_token": "..." }`, not a cookie-based session.
Protected requests need:

```text
Authorization: Bearer <access_token>
```

Also confirm `JWT_SECRET` is set consistently when signing and validating
tokens.

## Useful commands

```bash
# Install dependencies
npm install

# Start and stop local PostgreSQL
npm run db:dev:up
npm run db:dev:rm

# Prisma
npx prisma validate
npx prisma generate
npm run prisma:dev:deploy
npx prisma migrate status
npx prisma db seed

# Backend
npm run start:dev
npm run build
npm run test
npm run test:e2e

# Frontend, from ../dishi-app
npm run dev
npm run typecheck
npm test -- --run
npm run build
```

## Production readiness notes

Before deploying:

- Replace all development credentials and secrets.
- Restrict CORS to known frontend origins.
- Protect project and bookmark data with authentication and authorization.
- Do not run the destructive seed script against production.
- Use a managed PostgreSQL database and a production `DATABASE_URL`.
- Apply migrations during deployment with `prisma migrate deploy`.
- Add endpoint, authorization, and database integration tests.
- Review dependency audit results and update vulnerable packages.
- Configure structured logging and health checks.
