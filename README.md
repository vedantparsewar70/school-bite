# School Bite

Brunch pre-ordering for the S.B. Patil School canteen. Parents order and pay online before the
day's cutoff; canteen staff see what to prepare and hand meals over child by child; teachers order
their own meals; the admin manages menus, orders, refunds and reports.

Live site: https://school-bite.vercel.app (hosted on Vercel).

## Who uses it

**Parents** (`/parent/…`)
- Register, add children with their class and allergies.
- See each child's class menu and order the day's brunch, plus optional extras (at most 3 of each
  extra per child per day, only with that day's brunch). One brunch per child per day.
- Brunch price is set by class (defaults: Pre-primary ₹60, Primary ₹75, Secondary ₹90); staff and
  admin change it on the Student Menu page ("Brunch prices by class"; new orders only). Extras and
  the teacher menu keep their own per-dish prices.
- Order up to 08:30 IST on the meal day. No ordering on Sundays or on holidays set for the class.
- Pay online through Cashfree (UPI, cards, net banking). See orders, payments and receipts.
- Orders cannot be cancelled online; the canteen (admin) cancels and refunds in full.

**Teachers** (`/teacher/menu`)
- Order from the staff/teacher menu and pay through Cashfree, without an account. Always open.

**Canteen staff** (`/staff/…`)
- Serve screen: hand over today's meals one child at a time.
- Prepare/kitchen counts, history, teacher menu, monthly menu import.

**Admin** (`/admin/…`)
- Dashboard, student and teacher orders (cancel with full refund to the original payment method;
  a refund is never sent twice), kitchen view, menus and dishes, not-served list, payment
  exceptions, reports (CSV) and users.

## Tech

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- Google Cloud Firestore through `firebase-admin`. `lib/prisma.ts` is only the name of the
  Firestore data adapter (`lib/firestore-db.ts`); there is no Prisma or SQL database.
- Payments and refunds: Cashfree (signed webhooks; `lib/cashfree*.ts`).
- Sessions: JWT (`jose`) in an HTTP-only cookie; passwords hashed with `bcryptjs`.
- All dates and cutoffs use India time (IST).

## Running locally

1. `npm install`
2. Create `.env.local` from `.env.example`. Use a **test** Firebase project and the Cashfree
   **sandbox**; never point a local run at the production database or production Cashfree keys.
3. `npm run dev` and open http://localhost:3000.

Admin and staff accounts are set with `ADMIN_EMAIL`/`ADMIN_PASS` and `STAFF_EMAIL`/`STAFF_PASS`.
Firebase setup details (credentials, TTL policies): see `FIREBASE_SETUP_GUIDE.md`.

## Checks

```bash
npm test            # unit and API tests against an in-memory Firestore (no network)
npx tsc --noEmit    # type check
npm run build       # production build
```

## Scripts (`scripts/`)

Run only on purpose, with an explicit env file (`npx tsx --env-file=<file> scripts/<name>.ts`).

- `verify-firebase.ts`: checks the Firestore connection.
- `backup-db.ts`: writes a JSON backup of the main collections.
- `reconcile-refunds.ts`: read-only refund report (optionally compares with Cashfree).
- `generate-assets.ts`: regenerates the logo and icon images in `public/`.
- `list-test-data.ts` / `delete-test-data.ts`: data cleanup tools (dry run by default; see the
  notes at the top of each file before use).
