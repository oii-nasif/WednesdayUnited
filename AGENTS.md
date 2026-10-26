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
- AuthShell uses compact forms, a desktop-only image panel, and mobile bottom-navigation clearance; preserve natural scrolling for validation errors and unusually short screens rather than clipping controls.
- User management uses staff-checked approval and super-admin-checked role RPCs; role changes protect super-admin targets, and auth refreshes role reads after database changes.
- Notifications are persisted per recipient by match/approval database triggers; browser subscriptions are owner-filtered, cleaned up on unmount, and marking read uses an owner-checked RPC.
- Player approval displays use a shared owner-scoped profile query with periodic refresh; client registration gating mirrors database enforcement without replacing it.
- Audit logging is done by DB triggers (audit_trigger) writing to audit_logs, so app code never writes logs directly.
- Match data is read client-side with the browser Supabase client via queryOptions in src/lib/matches.ts.
- Payment reads use shared browser queryOptions; submissions are validated by a database trigger and decisions use a staff-checked, row-locking RPC, preventing forged approvals and repeated review.
- Donation goals use a shared multi-row active-goal query and browser inserts under staff RLS; selecting a fund passes its own ID to donation submissions, preserving separate contribution totals.
- Payment receipts live in a private owner-folder bucket, with owner/staff reads and short-lived signed URLs; attached receipts cannot be deleted.
- Payment QR codes use a separate private bucket and a path on payment settings; storage read permissions mirror settings visibility, staff manage instructions under RLS, and payment_method selects one display mode with database-validated targets.
- Profile photos live in the private avatars bucket with owner/staff-only reads; signed links are created by the signAvatarLinks server function (avatar-sign.*), which allows signed-in members any photo and anonymous visitors only photos of players on non-draft matches — never re-open storage SELECT to anon.
- Verified payment totals represent contributions only until the settlement ledger is implemented, so they must not be presented as spendable balances.
- Public participant identities are read from a trigger-synchronized, minimal player directory; private profiles remain owner/staff-only, avoiding exposure of email or other private fields through public match reads.
- Venue creation uses the browser database client under existing super-admin RLS; Google Maps uses the managed browser Embed API with venue name/address queries, keeping server credentials out of the browser.
- Match and venue deletion share a confirmation and browser-client helper under existing RLS; database foreign keys protect payment history and referenced venues, and returned rows prevent false success on permission-denied deletes.
- Player balances are an append-only ledger (ledger_entries) written only by staff-checked SQL functions: verified payments credit it; settle_match takes the total cost and the final team sheet, splits it per head and debits players (re-running it re-settles with logged reversals); record_adjustment logs cash/corrections. Marking a match played (status completed) requires settle_match. Payments tagged with a match pay that match first, the rest pays the oldest due. Who has paid a played match is visible to signed-in players. Donations fill donation_goals, not balances. Payments are capped at 2000 each.
