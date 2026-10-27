# Dishi: seed the DB, serve vendors via Swagger, connect the frontend

NestJS API for Dishi. Prisma generates the client into `prisma/generated`; that directory is build output and is not committed.

## Folder structure (Dishi-api)

```
Dishi-api/
├── prisma.config.ts                 # Prisma 7 config: schema path, migrations, seed command
├── .env                             # DATABASE_URL, DIRECT_URL, SUPABASE_*, FRONTEND_URL
├── prisma/
│   ├── schema.prisma                # the Dishi schema (replaces the library one)
│   ├── generated/                   # created by `prisma generate`; gitignore it
│   ├── migrations/
│   └── seed/
│       ├── seed.ts
│       └── mock-vendors.ts
└── src/
    ├── main.ts                      # Swagger (/api), CORS, ValidationPipe
    ├── app.module.ts
    ├── prisma/                      # global PrismaService + PrismaModule  (in this kit)
    ├── vendors/                     # public vendor + dish reads            (in this kit)
    ├── common/                      # keep: config, dto, filters, guards
    ├── supabase/                    # keep: Supabase admin client
    ├── auth/                        # Supabase JWT guard + POST /auth/sync
    ├── user/                        # /me, settings, deletion request
    ├── menu/                        # vendor-side dish and category CRUD          (later)
    ├── orders/                      # place order, KDS status updates             (later)
    ├── payments/                    # M-Pesa STK Push + callback                  (later)
    ├── payouts/                     # earnings and payouts                        (later)
    ├── banners/                     # promo banner admin + public read            (later)
    └── favorites/                   # replaces the old bookmark module            (later)
```

Legacy `bookmark/`, `project/`, and `src/test/` scaffolding is removed. The root `test/` directory remains for automated tests. Folders marked "later" are not implemented yet.

## 0. Before you start (5 min)

- In Supabase: Project Settings > Database. Copy the **pooler** string (port 6543) and the **direct** string (port 5432).
- `.env` (and Render env vars):
  - `DATABASE_URL` = pooler string (add `?pgbouncer=true`)
  - `DIRECT_URL` = direct string
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never in the frontend)
  - `FRONTEND_URL` = your Vercel URL (for CORS)

## 1. Replace the old schema with Dishi's

The Prisma schema contains Dishi's models. Existing migration files are immutable history and must not be deleted or edited just to remove legacy application models.

1. Review the current migration state and legacy table data on a non-production database first. Do not run `migrate dev` against production.
2. Generate a new forward migration only against a throwaway or staging database. Review its SQL and data impact before applying it anywhere. Never drop legacy tables until their data is confirmed disposable and the target has a verified backup.
3. Keep Supabase-managed `auth` and `storage` schemas untouched.
4. `npx prisma generate` (**required** after changing the schema; generated client output is ignored by Git.)

### What the schema covers

- **Identity:** `User` (id = Supabase user id; phone-first; `role` CUSTOMER / VENDOR / ADMIN), `UserSettings`, `DeletionRequest`, `Hub`.
- **Vendors:** `Vendor`, `VendorMember` (owner / manager / kitchen, for role-tied dashboards), `VendorHours`, `Cuisine`, `Amenity`.
- **Menu:** `MenuCategory`, `Dish` (`featured`, `popular`, `soldOut`, `active`).
- **Ordering:** `PickupSlot` (capacity), `Order` (pickup or delivery, status flow for the KDS), `OrderItem` (price and name snapshots).
- **Money:** `Payment` (M-Pesa STK Push fields plus a card slot), `Payout` (Earnings & Payouts page, commission in basis points).
- **Content and engagement:** `PromoBanner` (data-driven, admin-editable), `FavoriteVendor` / `FavoriteDish` (replace Bookmark), `Notification`.
- **Retention:** orders and payments survive account deletion with `userId` set to null. Run an anonymise job to clear `contactPhone` and `payerPhone`, then purge after 7 years.

## 2. Seed

1. Copy `prisma/seed/` into your `prisma/seed/` (`seed.ts` plus your `mock-vendors.ts`).
2. `npm i -D tsx` and `npm i @prisma/adapter-pg dotenv` (on Prisma 6, drop the adapter lines in `seed.ts`).
3. `npx prisma db seed`. It creates the Westlands hub, cuisines, amenities, 8 vendors, their categories and dishes, and a starter promo banner. Safe to re-run.

## 3. API + Swagger

1. Copy `src/vendors/` into `src/vendors/`.
2. Copy `src/prisma/` (global `PrismaService` + `PrismaModule`), `src/main.ts` (Swagger at `/api`, CORS, validation) and `src/app.module.ts` from the kit. Merge by hand if you already customised yours.
3. `AppModule` must import `PrismaModule` and `VendorsModule`.
4. Run `npm run start:dev`, open `/api` (or wherever your Swagger is mounted). Endpoints:
   - `GET /vendors` (filters: `q`, `cuisine`, `openNow`, `maxPickupMin`, `sort`)
   - `GET /vendors/{id}`
   - `GET /dishes/featured`
   - `GET /dishes/{id}`
5. Responses match your frontend `Vendor` / `Dish` types exactly. `priceRange`, `pickupAt`, `pickupInMin` and `pin` are computed from live data instead of stored, so the UI needs no reshaping.
6. Test checklist: `GET /vendors` returns 8 vendors; `GET /vendors/mama-njeris-kitchen` returns 16 dishes across 4 categories; `chicken pilau` shows `soldOut: true`; `GET /dishes/featured` excludes sold-out items; `GET /dishes/nope` returns 404.

## 4. Deploy on Render

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/src/main` (it is `dist/src/main` because `prisma/seed` is compiled too, which moves the output root. If your build puts `main.js` at `dist/main.js`, use that.)
- Seed once from your machine (it uses `DIRECT_URL`), not on every deploy.
- CORS is already set in the kit's `main.ts` from `FRONTEND_URL`. The app also listens on `0.0.0.0:$PORT`, which Render requires.
- Free Render instances sleep; first request can take ~30s.

## 5. Frontend (Vercel)

- Env: `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`
- Replace the mock exports with an RTK Query slice (your file already says to):

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Vendor, DishWithVendor } from '@/lib/vendors'; // keep the types, delete VENDORS

export const dishiApi = createApi({
  reducerPath: 'dishiApi',
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_URL }),
  endpoints: (b) => ({
    getVendors: b.query<Vendor[], void>({ query: () => '/vendors' }),
    getVendor: b.query<Vendor, string>({ query: (id) => `/vendors/${id}` }),
    getFeatured: b.query<DishWithVendor[], void>({
      query: () => '/dishes/featured',
    }),
    getDish: b.query<DishWithVendor, string>({
      query: (id) => `/dishes/${id}`,
    }),
  }),
});
export const {
  useGetVendorsQuery,
  useGetVendorQuery,
  useGetFeaturedQuery,
  useGetDishQuery,
} = dishiApi;
```

- Swap `VENDORS`, `getVendor`, `getDish`, `allDishes` usages for the hooks. Keep `CUISINES`, `AMENITIES`, `DEFAULT_CATEGORY` and the types as local constants.

## 6. Google and Apple login (Supabase dashboard)

**Redirect URL for both providers:** `https://<project-ref>.supabase.co/auth/v1/callback`

Supabase > Authentication > URL Configuration: set **Site URL** to your Vercel URL and add to **Redirect URLs**: `https://<your-app>.vercel.app/**` and `http://localhost:3000/**`.

**Google**

1. Google Cloud Console > APIs & Services > OAuth consent screen (External), then Credentials > Create OAuth client ID > Web application.
2. Authorized redirect URI: the Supabase callback above. Authorized JS origin: your Vercel URL and `http://localhost:3000`.
3. Paste Client ID and Secret into Supabase > Authentication > Providers > Google, enable it.

**Apple** (needs a paid Apple Developer account)

1. Identifiers: create an App ID with Sign in with Apple, then a **Services ID** (this is the client ID). Set its domain to `<project-ref>.supabase.co` and return URL to the Supabase callback.
2. Keys: create a key with Sign in with Apple, download the `.p8` once, note Key ID and Team ID.
3. Generate the client secret JWT from the `.p8` (Supabase docs link a generator). **It expires every 6 months**: put a reminder in your calendar.
4. Enter Services ID and secret in Supabase > Providers > Apple, enable it.

**Frontend sign-in**

```ts
await supabase.auth.signInWithOAuth({
  provider: 'google', // or "apple"
  options: { redirectTo: `${location.origin}/auth/callback` },
});
```

After the session exists, call `POST /auth/sync` with `Authorization: Bearer <session.access_token>` so the user lands in your DB.

## 7. Auth sync (next step, needs your code)

`User.id` is the Supabase user id, so sync is an upsert on first login (display name, avatar, provider, `lastLoginAt`, default `UserSettings`). Send me `supabase.service.ts`, the `auth` and `user` modules and your Prisma service file, and I'll wire token verification plus that upsert into what you have.

Note: your stored plan said Clerk phone OTP. Supabase Auth also does phone OTP, but needs an SMS provider (Twilio/MessageBird/Vonage); Africa's Talking isn't built in. Social login works without any of that.
