# Dishi API

NestJS API for Dishi, using PostgreSQL through Prisma and Supabase Auth.

## Structure

- `src/prisma/`: shared Prisma service
- `src/vendors/`: public vendor and dish reads
- `src/common/`: shared DTO, guard, filter, and configuration code
- `src/supabase/`, `src/auth/`, `src/user/`: authentication and account features
- `prisma/schema.prisma`: Dishi database schema
- `prisma/seed/`: reference and demo seed data
- `prisma/migrations/`: immutable database migration history
- `prisma/generated/`: generated Prisma client; ignored by Git

Legacy project and bookmark API scaffolding has been removed. The Dishi schema
uses `FavoriteVendor` and `FavoriteDish`; it does not contain `Project` or
`Bookmark` models.

## Local setup

See [SETUP.md](SETUP.md) for environment configuration, Prisma, seed, API, and
deployment instructions. Keep `.env` local and never commit credentials.

From this directory:

```sh
npm install
npx prisma generate
npm run build
```

Use the Supabase pooler URL only for the running application. Prisma migration
and seed commands use the direct connection URL. Do not run migrations against
a real database until its target, reviewed SQL, and backup/PITR status have
been confirmed.
