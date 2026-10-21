# Laundrify

Responsive laundry-shop management SaaS built with Next.js, TypeScript, and Supabase.

## Current implementation

- Email/password authentication and first-shop onboarding
- Multi-tenant Postgres schema with row-level security policies
- Customer directory: create, search, and prepare a WhatsApp click-to-chat message
- Order directory: search and filter by workflow status
- New order intake with multiple line items, per-piece/per-kilogram/fixed pricing, optional garment tags, collection deadline, discount, and an optional initial payment
- Per-shop order references generated transactionally by Postgres
- Order detail view with status transitions, status history, payment history, and outstanding balance
- Payment recording with server-side membership checks and balance validation

Dashboard overview metrics and recent-order preview are still demo data. The order and customer pages query Supabase. This is an in-development product and has not yet passed a full live production-readiness review.

## Requirements

- Node.js 20.9 or newer
- A Supabase project
- npm

## Run locally

```bash
npm install
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, then run:

```bash
npm run dev
```

Open http://localhost:3000. Never commit `.env.local`, and never expose a Supabase service-role key in browser code.

## Supabase setup / migration order

In Supabase Dashboard → SQL Editor, run these files in order:

1. `supabase/migrations/0001_initial_schema.sql` — base schema, onboarding RPC, and initial RLS policies.
2. `supabase/migrations/0002_order_workflow.sql` — atomic order creation, shop-specific order-number generation, controlled status updates with audit history, and guarded payment recording.

The second migration is required for order creation, status updates, and payments. Do not skip it. The migration files are committed to the repository; committing them does not apply them to your Supabase database.

## Product rules

- Each shop's records must be isolated from other shops through row-level security and server-side function checks.
- Per-piece, per-kilogram, and fixed-charge lines can coexist in one order.
- Order creation writes the header, items, initial status history, and any initial payment in one database transaction.
- Status changes are constrained and auditable. Delivering an order with a balance due requires an explicit confirmation in the UI.
- Payments are manual records and do not verify cash receipt or bank transfers. Payments cannot exceed the outstanding balance through the app's payment RPC.
- The base WhatsApp feature prepares a click-to-chat message; the owner reviews and sends it in WhatsApp.
- Currency is INR and the default shop timezone is Asia/Kolkata.

## Before production

Review and test all row-level security and role-escalation paths; implement refunds as auditable compensating entries; decide how a user chooses a shop if multi-shop access is enabled; replace dashboard demo metrics; add automated tests and deployment checks; and complete a live Supabase end-to-end test.