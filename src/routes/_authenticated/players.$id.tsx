import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { playerProfileQuery, positionLabel, roleLabel } from "@/lib/profile";
import { fmtDate, fmtTime } from "@/lib/matches";
import { balanceQuery } from "@/lib/ledger";
import { BalanceText } from "@/components/Balance";
import { statusLabel, statusVariant } from "@/components/MatchCard";
import { PageHeader } from "@/components/PageHeader";
import { ProfileSummary } from "@/components/ProfileSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/players/$id")({
  head: () => ({ meta: [
    { title: "Player Profile — Wednesday United" },
    { name: "description", content: "Staff view of a Wednesday United player's profile and games." },
    { property: "og:title", content: "Player Profile — Wednesday United" },
    { property: "og:description", content: "A player's profile and games." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { id } = Route.useParams();
  const { isStaff, loading } = useAuth();
  const { data: player, isPending, isError, refetch } = useQuery({ ...playerProfileQuery(id), enabled: isStaff });
  const { data: balance } = useQuery({ ...balanceQuery(id), enabled: isStaff });
  if (loading) return null;
  if (!isStaff) return <div className="mx-auto max-w-xl px-4 py-20 text-center text-muted-foreground">Only admins and moderators can view other players' profiles.</div>;

  const played = player?.registrations.filter((r) => r.match?.status === "completed").length ?? 0;
  const guests = player?.registrations.reduce((n, r) => n + r.guest_count, 0) ?? 0;
  return (
    <div className="page-enter">
      <PageHeader kicker="Squad users" title={<>Player <span className="text-accent">profile</span></>} actions={<Button variant="outline" className="border-white/25 bg-white/5 text-pitch-foreground hover:border-white/50 hover:bg-white/10 hover:text-pitch-foreground" asChild><Link to="/users"><ArrowLeft />All users</Link></Button>} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        {isPending ? <p className="text-muted-foreground">Loading profile…</p> : isError ? (
          <div role="alert" className="space-y-3"><p>Could not load this profile.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
        ) : !player ? <p className="text-muted-foreground">This player doesn't exist.</p> : (
          <>
            <ProfileSummary profile={player} role={roleLabel(player.roles)} />
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border bg-card p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Balance</dt><dd className="mt-1 text-lg leading-tight">{balance === undefined ? "…" : <BalanceText balance={balance} />}</dd></div>
              {[["Position", player.position ? `${player.position} · ${positionLabel(player.position)}` : "Not set"], ["Games played", played], ["Signed up", player.registrations.length], ["Guests brought", guests]].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-card p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-2xl leading-tight">{value}</dd></div>
              ))}
            </dl>
            <section>
              <h2 className="text-4xl leading-none">Fixtures</h2>
              <p className="mt-1 text-sm text-muted-foreground">Joined {fmtDate(player.created_at)}.</p>
              {player.registrations.length ? (
                <ul className="mt-4 divide-y rounded-2xl border bg-card">
                  {player.registrations.map((r) => r.match && (
                    <li key={r.id}>
                      <Link to="/matches/$id" params={{ id: r.match.id }} className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/50">
                        <CalendarDays className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 font-semibold">{r.match.title}</span>
                        <span className="text-sm text-muted-foreground">{fmtDate(r.match.starts_at)} · {fmtTime(r.match.starts_at)}</span>
                        {r.guest_count > 0 && <Badge variant="outline">+{r.guest_count}</Badge>}
                        <Badge variant={statusVariant[r.match.status]}>{statusLabel[r.match.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 rounded-2xl border border-dashed py-10 text-center text-muted-foreground">No fixtures yet.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
