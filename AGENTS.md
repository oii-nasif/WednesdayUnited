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
- Audit logging is done by DB triggers (audit_trigger) writing to audit_logs, so app code never writes logs directly.
- Match data is read client-side with the browser Supabase client via queryOptions in src/lib/matches.ts.
