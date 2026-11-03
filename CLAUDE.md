# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Wednesday United is a football-match organizing app (matches, venues, player registration with guests, prepayments with moderator verification). It is a Lovable-managed project: commits pushed to `main` sync back into the Lovable editor. **Never rewrite pushed history** (no force-push, amend, rebase, or squash of pushed commits), and keep `main` in a working state. Live app: https://wednesdayunited.lovable.app. `roadmap.md` tracks completed and pending phases.

## Commands

The lockfile is `bun.lock` (bun is configured in `bunfig.toml` with a 24h minimum-release-age guard; ask the user before adding entries to `minimumReleaseAgeExcludes`). npm scripts work too.

- `bun run dev`: Vite dev server
- `bun run build`: production build (nitro, Cloudflare target)
- `bun run lint`: ESLint
- `bun run format`: Prettier
- `bun run test`: Vitest, run once (jsdom, setup in `src/test/setup.ts`, tests in `src/**/*.test.ts(x)`)
- Run a single test file: `bunx vitest run src/test/payments.test.ts`. Filter by test name: `bunx vitest run -t "registration closes"`

## Stack and generated files

TanStack Start (React 19, file-based TanStack Router, SSR), TanStack Query, Supabase (auth, Postgres, storage), Tailwind v4, and shadcn/ui components in `src/components/ui`. The `@/` alias maps to `src/`.

Do not hand-edit these files:
- `src/routeTree.gen.ts`: generated from `src/routes/`. Read `src/routes/README.md` for routing conventions (`$id` params, `_layout` routes, no Next.js-style `pages/`).
- `src/integrations/supabase/*`: generated client, server client, auth middleware, and `types.ts` (DB types).
- `drizzle/schema.ts`: intentionally blank.
- `vite.config.ts`: `@lovable.dev/vite-tanstack-config` already includes the TanStack Start, React, Tailwind, tsconfig-paths, and nitro plugins. Adding them again breaks the build. `src/server.ts` is the SSR entry and wraps errors.

## Architecture

**The database enforces permissions, not app code.** Nearly all data access goes through the browser Supabase client (`@/integrations/supabase/client`) and depends on Postgres RLS. Server functions are not used. Schema, RLS policies, triggers, RPCs, and storage policies live in the SQL migrations in `drizzle/migrations/` (drizzle-kit, using `LOVABLE_DB_MIGRATION_URL`). Changing behavior often means writing a new migration rather than changing TS code.

- **Roles**: stored in `public.user_roles` (`player` / `moderator` / `super_admin`) and checked in SQL through `has_role` / `is_staff`. On the client, `src/lib/auth.tsx` (`AuthProvider`, `isStaff`, `isAdmin`) only gates the UI.
- **Auth routes**: routes under `src/routes/_authenticated/` are client-only (`ssr: false`). They redirect to `/auth` when there is no user.
- **Audit logs**: written by the DB `audit_trigger` into `audit_logs`. App code never writes audit logs.
- **Data fetching**: shared `queryOptions` live in `src/lib/matches.ts` (matches, locations, participant and registration rules) and `src/lib/payments.ts`. Routes and components reuse these instead of writing ad hoc queries.
- **Public identities**: match reads join registrations to `player_directory`, a minimal table kept in sync by a trigger. Do not join `profiles` for public data, because `profiles` (which holds email) is readable only by its owner and staff.
- **Payments**: `src/lib/payment-rules.ts` holds the client-side zod validation and totals. A DB trigger re-validates submissions. Staff approve or reject payments through a row-locking, staff-checked RPC, never through direct updates. Receipts go in a private storage bucket under per-owner folders and are read through short-lived signed URLs. Attached receipts cannot be deleted. Payments have a `purpose` (`match`, `advance`, `donation`) and are capped at ৳2000 each.
- **Balances (ledger)**: `ledger_entries` is append-only and client read-only; balance = sum of amounts (negative = due). Verified match/advance payments credit it inside `review_payment`. `settle_match(match, total_cost, lineup)` sets the team sheet to who played, splits the cost per head (guests included), debits each player and marks the match played (`completed`, labelled "Played" in the UI); running it on a played match re-settles, logging reversals of the old charges. A match only reaches `completed` through `settle_match`, and a played team sheet only changes through it. `record_adjustment` logs cash and corrections (note optional). `ledger_allocation` applies a payment tagged with a match to that match first, then everything else oldest debt first; `match_dues` (any signed-in user) and `player_match_dues` (self or staff) expose it. Donations go to `donation_goals.collected_amount`, never to balances. Client access lives in `src/lib/ledger.ts`.
- **Placeholder players**: staff add members who have not signed up (`profiles.placeholder = true`, no auth user, optional `phone`) through `create_placeholder_player`; they go on team sheets and in the ledger like anyone else. `merge_placeholder_player(placeholder, account)` moves their registrations, ledger entries, payments and notifications onto the signed-up account and deletes the placeholder. Real profiles are still tied to `auth.users` by trigger. Client access lives in `src/lib/users.ts` and `src/lib/placeholder-rules.ts`.
- **Deletion**: `src/lib/deletion.ts` together with `DeleteConfirmation.tsx`. Foreign keys block deleting matches that have payments and venues that are still in use (error `23503` maps to friendly messages). Deletes call `.select()` so that zero returned rows, which is what RLS denial produces, is reported as a failure.
- **Venues and maps**: super admins create venues through the browser client. Maps use the keyless Google embed (`maps.google.com/maps?q=…&output=embed`) with name or address queries, so they work on any domain with no API key or billing.
