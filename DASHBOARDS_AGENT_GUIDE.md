# Dishi Dashboards and Settings: Engineering Agent Guide

How to build every Dishi dashboard, the vendor KDS, and the role-aware Settings area **out of the existing codebase**, with access tied to user roles.

## 0. Scope and authority

- **Authoritative for schema, actors, permissions, RLS, invites and audit:** `AGENT_README_v2.md` sections 6, 7 and 7B. If this guide disagrees with v2, v2 wins, **except** the two deliberate changes listed in section 11 (Settings consolidation and the shared store-state model).
- **This guide covers the UI and data-flow layer:** shells, navigation, shared components, the KDS, the customer-facing vendor profile it feeds, dashboards per role, and Settings per role.
- Execution rhythm, evidence rules and stop conditions come from `AGENT_RUNBOOK.md`. Track progress in `docs/agent/PROGRESS.md`.
- Hard rules (from the main brief, repeated because they matter here): Dishi design system and existing pages only, never invent styles; primary button black, red only for payment moments; no "NEXT-GEN" in copy; no hardcoded or mock data; never weaken a test to get green.

## 1. Non-negotiables

1. **Reuse before you build.** Inventory the codebase first (section 2). Extend existing components with props or variants. Create new components only when nothing fits, and put them in `src/components/dashboard/*` (shared) or the route's `_components` (page-specific). No second UI kit, no copy-pasted near-duplicates.
2. **Role-driven, never role-hardcoded.** No `if (role === 'owner')` scattered in JSX. Visibility comes from the **registries** (section 4) and `<Can>` / `requirePermission()`. Hiding UI is cosmetic; the server and RLS enforce.
3. **Data only through `src/lib/data/*`.** Components never call Supabase directly (NestJS swap later).
4. **Every page has all states:** loading, empty, error, 403, offline (where relevant).
5. **Every sensitive action** (suspend, approve, fee change, price change, payout change, role change, CSV export) confirms with a reason and writes an audit row through the SQL function in v2 section 7.4.
6. **Times in Africa/Nairobi, money as integer KES** formatted at the edge only.

## 2. Step 0: discovery (required output before writing UI)

Produce `docs/agent/DASHBOARD_REUSE_MAP.md`. Method: list routes under `src/app`, list `src/components`, `src/hooks`, `src/store`, `src/lib`, `src/constants`; open the Settings page, the vendor page, Discover, orders, and `/dashboard/promos`.

| Need | Known or likely existing asset (verify path) | Action |
|---|---|---|
| App shell, side rail, nav | `discover/_components/SideRail`, any layout under `(app)` | Extend into `DashboardShell` or reuse its parts |
| Empty / error states | `components/ui/StateEmpty` | Reuse |
| Vendor card and live badges | `discover/_components/VendorTile` | Extend (live state badge) |
| Order summary | `orders/active/OrderPanel` | Reuse for order detail on KDS and Business where it fits |
| Promo banner | `discover/_components/PromoBanner`, `discover/content/promos` | Reuse as the **live preview** in the promos editor |
| Filters | `QuickFilters`, `lib/vendors/filter` | Reuse patterns for table filters |
| Settings page | existing `/settings` (sidebar: Account, Preferences, Other) | Extend with the registry (section 8) |
| Promo admin | existing `/dashboard/promos` | Fold into `/admin/promos` (redirect) |
| Routes and constants | `constants` (`ROUTES`, `LOCATION`) | Extend; `LOCATION` data moves to `hubs` table |
| Online status | `hooks/useOnlineStatus` | Reuse in KDS and Business |
| Store slices | `store/slices/{cart,favorites}` | Keep for customer client state only |

Also record: what the vendor profile page currently shows and where its data comes from; whether any KDS or vendor-order code already exists; which components are unstyled prototypes. Every row ends with **reuse / extend / new** and a reason. Do not skip rows; an "unknown" is a defect.

## 3. Who sees what

One person can hold several actors (customer + owner, for example); the header context switcher picks the active one and the server re-validates it (v2 7.2). Landing page by active actor:

| Actor | Lands on | Dashboards and surfaces | Settings groups |
|---|---|---|---|
| `customer` | `/discover` | Discover, vendor profiles, orders, favourites | Account, Preferences, Other |
| `vendor_kitchen` | `/kds` | KDS only | Account (limited), Preferences, KDS device prefs, Other |
| `vendor_manager` | `/business` | Business dashboard, KDS | Account, Preferences, Business (no payout), Other |
| `vendor_owner` | `/business` | Business dashboard, KDS | Account, Preferences, Business (incl. payout), Other |
| `platform_subadmin` | `/admin` | Only sections they hold permissions for | Account, Preferences, My access, Other (MFA mandatory) |
| `platform_superadmin` | `/admin` | Everything | Account, Preferences, My access, Platform, Other |

Public (no login): marketing pages and the customer-facing vendor profile `/vendor/[id]` (read-only, no private data).

## 4. Architecture

### 4.1 Registries are the single source of truth

`src/lib/dashboard/nav.ts` exports an array: `{ id, label, href, icon, area: 'admin'|'business'|'kds'|'customer', requires: Permission | VendorRole | ((actor) => boolean) }`.

This one array drives: the desktop sidebar, the mobile bottom tab bar, the 403 page ("you need X"), breadcrumb titles, and a **generated authz test** (every registered route × every actor → expected allow/deny). A route without a registry entry fails CI. `src/lib/settings/registry.ts` does the same job for Settings (section 8).

### 4.2 Shells

| Shell | Used by | Behaviour |
|---|---|---|
| `AdminShell` | `/admin/**` | Desktop-first sidebar + top bar, usable on tablet; shows context switcher, hub scope chip for scoped sub-admins |
| `BusinessShell` | `/business/**` | **Mobile-first**: bottom tab bar on phones, sidebar on desktop; business switcher for multi-outlet owners |
| `KdsShell` | `/kds/**` | Kiosk: no sidebar, status strip only, fullscreen toggle, wake lock |
| `SettingsShell` | `/settings/**` | The existing settings layout, sidebar groups filtered by the registry |

All shells share `DashboardShell` primitives (top bar, nav renderer, content frame). Build the primitives once.

### 4.3 Page pattern

Server component page → `requirePermission()` (redirect or 403 page) → data-layer fetch → pass plain props to small client islands. Filters, sort, page and search live in **URL search params** so views are linkable and back-button safe. Redux stays for client-only state (cart, favourites).

### 4.4 Shared building blocks (build once, in `src/components/dashboard/`)

`DataTable` (server-driven pagination, sort, filter, search; row actions; bulk select), `KpiCard` / `KpiGrid` (fed from SQL views), `DateRangePicker` (Nairobi time), `StatusBadge` (icon + text, never colour alone), `ConfirmDialog` (with required reason), `ErrorPanel`, `ForbiddenPage`, `CsvExportButton` (permission-gated and audited), `Can` component, `useRealtime(table, filter)` hook (wrapped in the data layer so NestJS WebSockets can replace it later). Reuse `StateEmpty` for empty states.

## 5. The KDS and the store-state spine

### 5.1 Principle

The KDS is the vendor's live operating console **and the write side of the store's live state**. The customer-facing vendor profile, Discover tiles, search, cart validation and order tracking are **read sides of the same state**. One model. No copies, no hand-maintained flags on the customer side.

Note that Discover already says "Earliest pickup first": that ordering only means something if it is computed from live vendor state.

### 5.2 Store state (single source in the database)

Expose it as a view `vendor_live_state` (not a table) plus a function `vendor_is_orderable(vendor_id, item_ids, slot)`:

| Field | Source |
|---|---|
| `status` (`open|paused|closed`), `paused_until` | Vendor toggles on KDS; auto-resume job |
| `accepting_orders` | Computed: status + opening hours + holiday closures + capacity |
| `prep_estimate_min` | Vendor default plus recent accepted prep times |
| `queue_depth` | Count of orders in `PLACED`, `ACCEPTED`, `PREPARING` |
| `busy_level` (`calm|busy|slammed`) | Computed from `queue_depth` vs capacity (thresholds in `DOMAIN_RULES.md`) |
| `next_pickup_at` | Earliest slot with remaining capacity |
| per-slot `capacity`, `booked` | Settings + orders |
| per-item `is_available`, `sold_out_until` | KDS sold-out toggle |

`place_order` **re-validates against `vendor_is_orderable` on the server**, so a stale customer screen can never order a sold-out item or place an order into a paused store. The UI handles that rejection gracefully ("This just sold out").

### 5.3 Who reads it

| Surface | Reads | Freshness |
|---|---|---|
| Vendor profile `/vendor/[id]` | Status badge (Open / Busy / Paused / Closed), "Ready in about X min", next pickup slot, slot picker with remaining capacity, sold-out items | Realtime subscription on live state; static profile parts cached and refreshed with `revalidateTag('vendor-<id>')` when the Business dashboard edits them |
| Discover `VendorTile` and sorting | Open and busy badge, `next_pickup_at` for "Earliest pickup first" | Revalidate (60 s) plus Realtime for open/closed |
| Cart and `OrderPanel`, checkout | Availability re-check at checkout; per-item and slot validity | At action time, server-validated |
| Order tracking | `order_status_events` written by KDS transitions | Realtime |
| Business dashboard | Same orders for history, reports and earnings | On load, with revalidation |
| Admin | Monitoring and support | On load |

Public profile pages must never expose private data (payout number, staff, internal notes).

### 5.4 KDS requirements (build to this; surfaces and state machine are in v2 section 3)

**Layout.** `KdsShell`, landscape and portrait. Top status strip: connection state, store status toggle (open / pause new orders / closed), sound on-off, clock, fullscreen. Main board: **New → Preparing → Ready → Collected**, cards ordered by pickup time. Detail drawer on tap. Side panels: Slot timeline, Sold-out manager, Pause controls.

**Order card.** Short order number, customer display name only, items with quantities and notes, pickup time with countdown (turns urgent at 10 minutes or less, late after), payment status (paid by M-Pesa or not), total. Status by icon and text. Base text readable at arm's length (18 px minimum on the board), tap targets 48 px minimum.

**Actions.**
- Accept (choose prep time: 5, 10, 15, 20 or custom), Reject (reason required), Mark ready, Mark collected (pickup code entry; QR is optional later).
- Non-destructive moves are one tap with a **10-second undo**. Destructive moves (reject, cancel) confirm.
- All transitions call `transition_order(order_id, from, to)`. The function **rejects if the order is no longer in `from`**, so two tablets or a double tap cannot corrupt state; the UI shows "Already updated by <who>" and refreshes.

**Alerts.** New orders play a looping sound until acknowledged, with a visual flash. Audio needs one tap to unlock (show an "Enable sound" prompt). Use the Wake Lock API to keep the screen on (feature-detect and fall back quietly), vibrate on supporting phones.

**Reliability.**
- Offline: a clear banner, mutations disabled (never appear to succeed offline).
- Reconnect: resubscribe **and refetch the whole active set** so missed events cannot leave a stale board.
- Optimistic updates with rollback on error.
- Rush control: when `queue_depth` reaches capacity, prompt "Pause new orders?"; optional auto-pause threshold lives in Business settings.

**Sold-out manager.** Searchable item list, one-tap toggle, choose "until I turn it back on" or "until tomorrow". Change shows on the vendor profile within seconds.

**Slot timeline.** Pre-orders by pickup slot with capacity per slot, so the vendor can see the lunch rush coming.

**Roles.** Kitchen, manager and owner can use the KDS. Manager and owner also see a link to `/business`. A kitchen user who opens `/business` gets the 403 page.

**Performance.** 50 active orders render smoothly on a low-end tablet; Realtime handlers update individual cards, not the whole board.

### 5.5 KDS acceptance

- Two browsers: a customer places an order; the vendor KDS rings and shows it; vendor accepts, marks ready, collects with the code; the customer sees every status change live.
- Vendor marks an item sold out: it shows sold out on the vendor profile, and a checkout attempt is rejected by the server with a friendly message.
- Vendor pauses the store: the vendor profile badge, Discover tile and cart all reflect it, and `place_order` refuses.
- Disconnect and reconnect the KDS network: no missed orders, no stale cards.
- Double tap and two-tablet race: exactly one transition wins, the other shows "Already updated".

## 6. Dashboards to generate

Full feature detail for each is in `AGENT_README_v2.md` section 7B. This table maps each to **routes, access and what to build from**.

### 6.1 Dishi superadmin and sub-admin (`/admin`, `AdminShell`)

| Route | Needs | Build from |
|---|---|---|
| `/admin` | `overview.view` | `KpiGrid` from SQL views, `DateRangePicker`, hub filter |
| `/admin/applications` | `vendors.review` | `DataTable`, review drawer (approve, reject with reason, request info) |
| `/admin/vendors`, `/admin/vendors/[id]` | `vendors.manage` | `DataTable`, vendor detail with read-only business view, suspend and reinstate dialog |
| `/admin/users` | `users.view` (`users.manage` for actions) | `DataTable`, masked phone with audited reveal, deletion requests queue |
| `/admin/orders` | `orders.view` (`orders.support` for actions) | `DataTable`, order detail reusing `OrderPanel` where it fits |
| `/admin/payments`, `/admin/payouts` | `payments.view`, `payouts.manage` | Ledger table, payout batches, approve with step-up auth, reconciliation, CSV |
| `/admin/promos`, `/admin/promos/[id]`, `/admin/coupons` | `promos.manage`, `promos.publish`, `coupons.manage` | Editor with live preview using the **real** `PromoBanner`; status workflow; analytics |
| `/admin/hubs` | `hubs.manage` | Simple CRUD table; replaces hardcoded `LOCATION` |
| `/admin/staff` | superadmin only | Create sub-admin (phone + preset + hub scope), "effective permissions" preview, suspend, remove |
| `/admin/audit` | `audit.view` | Read-only filtered log with export |
| `/admin/settings` | superadmin only | Redirects into `/settings/platform` (section 8) |

Sub-admins use the same routes. They see only nav items they hold permissions for, and hub scope applies to every query through RLS.

### 6.2 Vendor business dashboard (`/business`, `BusinessShell`, mobile-first)

| Route | Roles | Build from |
|---|---|---|
| `/business` | owner, manager | Home KPIs, onboarding checklist (menu item, hours, verified payout number, store open) |
| `/business/orders` | owner, manager | `DataTable`, filters, CSV |
| `/business/menu` | owner, manager | Category and item manager, photo upload with limits, bulk sold-out, price changes audited. **Edits revalidate the public vendor profile** (5.3) |
| `/business/team` | owner (all roles), manager (kitchen only) | Members and pending invites, invite by phone, change role, remove |
| `/business/earnings` | owner, manager | Totals, platform fee shown separately, payout history |
| `/business/promos` | owner, manager | Submit and track vendor promo requests |
| `/business/reports` | owner, manager | Sales by day, item and slot, CSV |
| `/business/pending` | applicant | Application status, respond to "needs info", re-apply |
| Store profile, hours, slots, payout | owner, manager (payout: owner) | Live in **Settings → Business** (section 8); `/business/store` redirects there |

### 6.3 KDS (`/kds`)

Section 5. It is the highest-priority UI in this guide; build it before the dashboards.

## 7. Customer-facing vendor profile `/vendor/[id]`

Reads the store-state spine (5.2, 5.3). Contents: cover and description, cuisine tags, hub and location, hours, pickup instructions, live status badge with ETA, menu by category with sold-out states, slot picker with remaining capacity, favourites, add to order (single-vendor cart rule), pickup and delivery options per the design. Offline: show last known data with the existing "may be out of date" message and ordering paused.

Vendor edits made in **Settings → Business** or `/business/menu` must appear here within seconds (live parts through Realtime, static parts through `revalidateTag`). Verify this end to end; it is the proof that the KDS and Business dashboard really are the source of truth.

## 8. Settings: one entry point, different content per user

### 8.1 Architecture

- Keep the existing Settings layout and sidebar style (groups **Account**, **Preferences**, **Other**, now extended with **Business** and **Platform**). Canonical routes: `/settings/<group>/<section>`.
- `src/lib/settings/registry.ts` defines every section: `{ id, group, label, href, audience: ActorKind[], requires?, component }`. The sidebar, the mobile section list, direct-URL access control and the authz test are all generated from it.
- Every section is a form backed by a **shared zod schema** used by both the client form and the server action. The server action calls `requirePermission()`, validates, saves through the data layer, and audits business and platform changes.
- Storage: `user_settings` (per profile, versioned JSON), `vendor_settings` (per business), `platform_settings` (v2). **Per-device preferences** (KDS sound volume, text size) use `localStorage` inside try/catch with a working default; they are never required for correctness.
- UX for all sections: dirty-state guard, inline validation, success and failure feedback, optimistic update with rollback, accessible forms, mobile layout.

### 8.2 Sections by audience

| Group | Section | Customer | Kitchen | Manager | Owner | Sub-admin | Superadmin |
|---|---|---|---|---|---|---|---|
| Account | Profile (display name, hub) | yes | yes | yes | yes | yes | yes |
| Account | Payment number (M-Pesa, for paying) | yes | no | no | no | no | no |
| Account | Notifications (event types differ per actor: order updates for customers; new-order and low-stock alerts for vendors; applications and failures for staff) | yes | yes | yes | yes | yes | yes |
| Preferences | Appearance | yes | yes | yes | yes | yes | yes |
| Preferences | Language and region | yes | yes | yes | yes | yes | yes |
| Preferences | KDS device preferences (sound, alert volume, text size, board layout) | no | yes | yes | yes | no | no |
| Access | My access (role, permissions, business or hub scope, read-only) | no | yes | yes | yes | yes | yes |
| Business | Store profile (name, description, cover, cuisine tags) | no | no | yes | yes | no | no |
| Business | Hours and closures | no | no | yes | yes | no | no |
| Business | Pickup and slots (capacity, lead time, instructions) | no | no | yes | yes | no | no |
| Business | Ordering rules (default prep time, auto-pause threshold, max active orders) | no | no | yes | yes | no | no |
| Business | Team (links to `/business/team`) | no | no | kitchen only | yes | no | no |
| Business | Payout details (change needs step-up auth and SMS to old and new number) | no | no | view only | yes | no | no |
| Platform | Fees and commission | no | no | no | no | no | yes |
| Platform | Ordering maintenance mode, announcement banner, feature flags | no | no | no | no | no | yes |
| Platform | Security policy (MFA required, session timeouts) | no | no | no | no | no | yes |
| Other | Privacy and data | yes | yes | yes | yes | yes | yes |
| Other | Sessions and sign-out (sign out of all devices; staff also manage MFA) | yes | yes | yes | yes | yes (MFA mandatory) | yes (MFA mandatory) |
| Other | Help and support | yes | yes | yes | yes | yes | yes |
| Other | Danger zone (account deletion, SMS-confirmed) | yes | yes | yes | blocked while the business is active or payouts unsettled | yes | blocked for the last superadmin |

Accounts are phone-first (display name, region hub, M-Pesa number). No email, card details, ID or GPS is collected unless a logged decision changes that. Deletion keeps payment and order records up to 7 years without the name.

### 8.3 Settings acceptance

- Each actor sees exactly its rows from 8.2, no more. Direct URL to a hidden section returns the 403 page.
- Changing a Business setting (for example hours or slot capacity) updates the vendor profile and KDS within seconds.
- Platform settings changes are audited and superadmin-only (RLS verified, not just UI).
- Generated authz test covers every settings route × every actor.

## 9. Build order, with gates

| Step | Work | Exit gate |
|---|---|---|
| S0 | Discovery, `DASHBOARD_REUSE_MAP.md`, nav and settings registries, generated authz test skeleton | Reuse map complete; registries compile; test runs |
| S1 | Shared building blocks and shells | Each block has a story or test; 403 page works |
| S2 | Store-state spine: `vendor_live_state`, `vendor_is_orderable`, `transition_order`, data-layer functions, `useRealtime` | SQL tests green; `place_order` refuses paused or sold-out |
| S3 | **KDS**, then wire vendor profile and Discover tiles to the spine | Section 5.5 passes on two real browsers |
| S4 | Settings registry and all sections by role | Section 8.3 passes |
| S5 | Business dashboard | Owner and manager flows pass; menu edit shows on the profile |
| S6 | Admin: overview, applications, vendors, users, orders, payments, payouts, hubs, staff, audit | Full vendor lifecycle from the dashboard, with audit rows |
| S7 | Promos and coupons (editor preview uses real `PromoBanner`) | Publishing shows on `/discover` within the revalidate window |
| S8 | Hardening: full authz matrix, per-actor RLS tests, per-role Playwright, accessibility (axe), Lighthouse mobile for KDS and Business, state coverage sweep | All green; gaps stated plainly |

Prerequisites from v2 (login fixed, actors, RLS, audit) must be in place before S2. If they are not, stop and say so.

## 10. Testing

- **Seed one test user per actor** (`supabase/seed.sql`, clearly marked test data) and sign in as each in Playwright through the real UI with Clerk's testing helpers. No mocks.
- Generated authz matrix (registry × actor); RLS tests per actor; component tests for nav filtering, 403 and empty/error states; the two-browser KDS flows in 5.5; Settings visibility tests per actor.
- Accessibility: axe on every dashboard page and the KDS; keyboard-only pass on Business; touch-target check on KDS.
- Never ship a page whose only test is a mocked render.

## 11. Decisions to log (with a recommended default)

1. **Settings consolidation (deviates from v2 7.7).** `/settings` is the single implementation. `/business/store` redirects to `/settings/business/store`, and `/admin/settings` redirects to `/settings/platform`. Update route protection and the authz test accordingly.
2. **Shared store state (extends v2 section 3).** Menu manager, store settings and store status are served by the Business dashboard and Settings, while the KDS keeps live operations. All write to the same state that the vendor profile reads.
3. Auto-accept orders: default **off**.
4. "Order ready" notification channel: in-app first; SMS through Africa's Talking if you approve the cost.
5. `busy_level` thresholds and the default auto-pause behaviour.
6. Whether kitchen staff may pause the store (default **yes**) or change prices (default **no**).
7. Ticket printing, QR pickup scan, ratings display: out of scope for the pilot unless you say otherwise.

## 12. Definition of done (per page)

Registered in the nav or settings registry; permission-gated server-side with a test; loading, empty, error and 403 states; mobile and tablet layout checked (Business and KDS mobile-first); keyboard and contrast pass; data through the data layer with no mock arrays; sensitive actions confirmed and audited; reuse recorded in `DASHBOARD_REUSE_MAP.md`; evidence ticked in `PROGRESS.md`.

## 13. Report format (end of every step and session)

1. Done (files, one line each)  2. Verified (how, with evidence)  3. Not verified or blocked (why)  4. Needed from me  5. Next step
