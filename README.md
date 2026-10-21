# Laundrify

Responsive laundry shop management SaaS starter built with Next.js, TypeScript, and Supabase.

## Current status

This is an early starter milestone, not a production-ready app:
- Responsive dashboard UI with sample data
- Supabase browser-client helper
- Initial multi-tenant PostgreSQL schema with row-level security policies
- Core tables for shops, members, customers, services, orders, order items, payments, status history, expenses, and notification logs

Dashboard values are currently hard-coded. Authentication, live queries, order creation, transaction-safe order numbering, financial invariants, and notification delivery still need implementation and testing.

## Requirements

- Node.js 20.9 or newer
- A Supabase project
- npm

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The dashboard currently uses sample data and can render without Supabase credentials. Authentication and onboarding are not wired up yet.

## Connect Supabase

1. Create a Supabase project.
2. In Supabase Dashboard → SQL Editor, run `supabase/migrations/0001_initial_schema.sql`.
3. Copy the project URL and anon/publishable key from Project Settings → API into `.env.local`.
4. Never expose a Supabase service-role key in browser code or commit secrets.

## Product rules

- Each shop's data must be isolated from other shops.
- Base WhatsApp feature uses click-to-chat with a pre-filled message; the user must tap Send in WhatsApp.
- Official WhatsApp Cloud API is a separate optional integration for bulk/automated messaging; client-vs-provider billing must be confirmed before implementation.
- Cash, UPI, card, and bank transfers are recorded manually; this does not verify actual payment.
- Per-piece and per-kilogram order lines can coexist in one order.
- Keep payment history auditable; refunds and corrections should use compensating entries.
- Currency is INR and the default shop timezone is Asia/Kolkata.

## Next milestone

Implement sign-in/sign-up, first-shop onboarding, shop selection, and server-enforced membership checks before connecting the dashboard to real data.
