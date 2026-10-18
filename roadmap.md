# Wednesday United roadmap

- [x] Add email/password sign-up and sign-in alongside Google; every new account waits for staff approval
- [x] Add a 5-guest default cap per player that staff can change per match
- [x] Let moderators add, edit and delete venues
- [x] Add a player profile page with preferred position (GK, DEF, MID, FWD, ALL)
- [x] Apply migration 0008 and regenerate Supabase types
- [ ] Confirm the email auth provider is enabled with email confirmation
- [x] Let staff view any player's profile and switch to a player view of the site

- [x] Add staff user approvals, super-admin moderator management, and private in-app notifications
- [x] Transfer super-admin access to nasif.ishtiaque.islam@gmail.com and make nasif.bs1062@gmail.com a player

- [x] Show player approval status and explain closed registration deadlines

- [x] Add confirmed match and venue deletion without removing linked payment history
- [x] Refresh the overall design and add interactive match browsing and management
- [x] Verify deletion flows and refreshed layouts

- [x] Add venue creation for super admins and embedded Google Maps on match pages
- [ ] Google Maps display verification — requires checking a match with a venue on an authorized deployed origin; live Maps checks are unavailable in the agent sandbox

- [x] Phase 1: public match pages, Google sign-in, roles (super admin auto-assigned), join/leave with guests, moderator match management, manual participants, audit log capture
- [ ] Phase 2: financial management
  - [x] Prepayments: bank details, transaction ID, private screenshot, moderator verification and payment history
  - [ ] Authenticated payment-flow verification — blocked until the first user signs in and the designated bank details are provided
  - [x] Player balances ledger: per-head match cost settlement, dues and credit, advance payments, ৳2000 payment cap, staff balances and transaction log, cash adjustments
  - [x] Match ball donation fund (৳3500 goal) with progress
  - [ ] Apply migration 0010 and regenerate Supabase types to drop the untyped view in src/lib/ledger.ts
- [ ] Phase 3: player profiles & stats, match photos
- [ ] Phase 4: admin pages (users/roles, locations, financial overview, audit log viewer, settings)
