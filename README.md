# BeautyBook

Directory of salons, barbers and beauty vendors in Malaysia, starting with Klang Valley. Live at [beautybook.my](https://beautybook.my).

Customers find a shop, pick a service and a preferred time, and send the request to the shop on WhatsApp. Shop owners claim their listing with a code sent to the listed WhatsApp number, then manage their menu, hours, photos and requests. Staff run the directory from `/admin`.

## Stack

- Next.js 16 (App Router, Cache Components), Tailwind CSS 4
- Supabase: Postgres with row-level security on every table, Auth (Google, Facebook, phone OTP, email link), Storage
- WhatsApp: `wa.me` links for customer requests; the WhatsApp Cloud API only sends claim codes

## Run it locally

Needs Node 22 and Docker.

```sh
npm install
npx supabase start          # applies supabase/migrations and supabase/seed.sql
cp .env.example .env.local  # fill the Supabase keys from `npx supabase status`
npm run dev
```

Without WhatsApp or Turnstile keys, development still works: claim codes are printed in the dev server log and the captcha check is skipped. Production refuses to run without them.

To make yourself a platform owner after you sign in once with email or Google:

```sh
npm run make-owner -- you@example.com
```

## Checks

```sh
npm run lint
npm run typecheck
npm run db:test   # row-level security tests against the local database
npm run build
```

CI runs all four on every pull request.

## Where things are

| Path | What |
| --- | --- |
| `supabase/migrations` | Schema, security rules, search functions, reference data (categories, Klang Valley areas, service templates) |
| `supabase/tests/rls_checks.sql` | What each kind of user can and can't read or change |
| `src/app/[area]`, `src/app/[area]/[category]` | Area and category pages (the SEO hubs) |
| `src/app/shop/[slug]` | Shop profile and the WhatsApp booking-request form |
| `src/app/claim`, `src/app/owner` | Claim flow and owner dashboard |
| `src/app/account` | Favourites, notes, request and search history |
| `src/app/admin` | Listings, import (CSV, XLSX, JSON) with undo, claims, reports, staff and roles, audit log, redirects |
| `scripts/discover-places.ts` | Collects Google Place IDs into the discovery queue (IDs only, no Google content is stored) |

## Importing listings

`/admin/import` takes CSV, XLSX or JSON with up to 500 rows; download the template there. Only `name`, `category` and `area` are required. A row updates an existing listing when its `slug`, `google_place_id` or `phone` matches; a row whose name matches an existing listing in the same area is skipped, so add the slug to update it. Every import can be undone from the same page.
