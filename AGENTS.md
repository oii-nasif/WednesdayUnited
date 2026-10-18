<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Roles live in public.user_roles (player/moderator/super_admin) checked via has_role/is_staff SQL functions; RLS is the source of truth for permissions.
- User management uses staff-checked approval and super-admin-checked role RPCs; role changes protect super-admin targets, and auth refreshes role reads after database changes.
- Notifications are persisted per recipient by match/approval database triggers; browser subscriptions are owner-filtered, cleaned up on unmount, and marking read uses an owner-checked RPC.
- Player approval displays use a shared owner-scoped profile query with periodic refresh; client registration gating mirrors database enforcement without replacing it.
- Audit logging is done by DB triggers (audit_trigger) writing to audit_logs, so app code never writes logs directly.
- Match data is read client-side with the browser Supabase client via queryOptions in src/lib/matches.ts.
- Payment reads use shared browser queryOptions; submissions are validated by a database trigger and decisions use a staff-checked, row-locking RPC, preventing forged approvals and repeated review.
- Payment receipts live in a private owner-folder bucket, with owner/staff reads and short-lived signed URLs; attached receipts cannot be deleted.
- Verified payment totals represent contributions only until the settlement ledger is implemented, so they must not be presented as spendable balances.
- Public participant identities are read from a trigger-synchronized, minimal player directory; private profiles remain owner/staff-only, avoiding exposure of email or other private fields through public match reads.
- Venue creation uses the browser database client under existing super-admin RLS; Google Maps uses the managed browser Embed API with venue name/address queries, keeping server credentials out of the browser.
- Match and venue deletion share a confirmation and browser-client helper under existing RLS; database foreign keys protect payment history and referenced venues, and returned rows prevent false success on permission-denied deletes.
- Player balances are an append-only ledger (ledger_entries) written only by staff-checked SQL functions: verified payments credit it, settle_match splits a match's total cost per head and debits players, reopen_match reverses charges, record_adjustment logs cash/corrections. Completing a match requires settle_match; settled team sheets are locked. Donations fill donation_goals, not balances. Payments are capped at 2000 each.
