import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/matches";
import { Badge } from "@/components/ui/badge";
import { statusVariant, statusLabel } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CalendarDays, Users, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Games — Wednesday United" },
      { name: "description", content: "Your Wednesday United registrations and match history." },
      { property: "og:title", content: "My Games — Wednesday United" },
      { property: "og:description", content: "Your registrations and match history." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-regs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("registrations")
        .select("id, guest_count, match:matches(id, title, starts_at, status, location:locations(name, area))")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).sort((a, b) => (b.match?.starts_at ?? "").localeCompare(a.match?.starts_at ?? ""));
    },
  });
  const attended = data?.filter((r) => r.match?.status === "completed").length ?? 0;
  const guests = data?.reduce((n, r) => n + r.guest_count, 0) ?? 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 page-enter">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-semibold uppercase text-primary">Wednesday United / My squad</p><h1 className="text-5xl">Hey, {(user?.user_metadata?.['full_name'] as string | undefined)?.split(" ")[0] ?? "player"}</h1></div><Button variant="accent" asChild><Link to="/">Find a match<ArrowUpRight /></Link></Button></div>
      <p className="mt-1 text-sm capitalize text-muted-foreground">{roles.map((r) => r.replace("_", " ")).join(" · ")}</p>
      <div className="mt-6 grid grid-cols-3 gap-4 border-y py-6">
        {[["Registrations", data?.length ?? 0, CalendarDays], ["Matches attended", attended, Trophy], ["Guests brought", guests, Users]].map(([l, v, Icon]) => { const StatIcon = Icon as typeof Users; return (
          <div key={String(l)}>
            <StatIcon className="mb-3 size-5 text-primary" />
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="font-display text-5xl text-primary">{v}</p>
          </div>
        ); })}
      </div>
      <h2 className="mb-3 mt-10 text-3xl">My matches</h2>
      {data && data.length ? (
        <ul className="divide-y border-y bg-card">
          {data.map((r) => r.match && (
            <li key={r.id}>
              <Link to="/matches/$id" params={{ id: r.match.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted">
                <span className="font-semibold">{r.match.title}</span>
                <span className="text-sm text-muted-foreground">{fmtDate(r.match.starts_at)} · {fmtTime(r.match.starts_at)} · {r.match.location?.name}</span>
                {r.guest_count > 0 && <Badge variant="secondary">+{r.guest_count}</Badge>}
                <Badge variant={statusVariant[r.match.status]} className="ml-auto">{statusLabel[r.match.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-y p-10 text-center text-muted-foreground">
          You haven't joined a match yet. <Link to="/" className="text-primary underline">Find one</Link>
        </div>
      )}
      <Link to="/payments" className="mt-8 inline-block text-sm font-medium text-primary hover:underline">View payment history →</Link>
    </div>
  );
}
