import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/matches";
import { Badge } from "@/components/ui/badge";
import { statusVariant, statusLabel } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowUpRight, CalendarDays, Users, Trophy } from "lucide-react";
import { PageHeader, SectionHeading, Stat } from "@/components/PageHeader";
import { PlayerCard } from "@/components/PlayerCard";
import { SquadStatusNotice } from "@/components/SquadStatusNotice";
import { CountUp } from "@/components/CountUp";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

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
  const { user, roles, approval } = useAuth();
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
  const fullName = (user?.user_metadata?.["full_name"] as string | undefined) ?? "Player";
  const avatar = user?.user_metadata?.["avatar_url"] as string | undefined;
  const role = roles.includes("super_admin") ? "Super admin" : roles.includes("moderator") ? "Moderator" : "Player";
  return (
    <div className="page-enter">
      <PageHeader kicker="My squad" title={<>Hey, <span className="text-accent">{fullName.split(" ")[0]}</span></>} actions={<Button variant="accent" size="lg" asChild><Link to="/">Find a match<ArrowUpRight /></Link></Button>}>
        Your season so far, and every fixture you've signed up for.
      </PageHeader>
      {(approval === "pending" || approval === "rejected") && <div className="mx-auto max-w-6xl px-4 pt-10"><SquadStatusNotice status={approval} /></div>}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PlayerCard name={fullName} avatar={avatar} role={role} rating={attended} stats={[{ label: "Apps", value: attended }, { label: "Signed", value: data?.length ?? 0 }, { label: "Guests", value: guests }]} />
          <p className="text-center text-xs text-muted-foreground">The big number is your appearances. Show up on Wednesday to raise it.</p>
        </div>
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[{ label: "Registrations", value: data?.length ?? 0, icon: CalendarDays, tone: "primary" as const }, { label: "Matches attended", value: attended, icon: Trophy, tone: "accent" as const }, { label: "Guests brought", value: guests, icon: Users, tone: "primary" as const }].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border bg-card p-5 shadow-card"><Stat icon={<Icon />} tone={tone} label={label} value={<CountUp value={value} />} /></div>
            ))}
          </div>
          <SectionHeading kicker="Fixture list" title="My matches" action={<Button variant="ghost" asChild><Link to="/payments">Payment history<ArrowRight /></Link></Button>} />
          {data && data.length ? (
            <ul className="space-y-3">
              {data.map((r, i) => r.match && (
                <li key={r.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                  <Link to="/matches/$id" params={{ id: r.match.id }} className="group flex items-center gap-4 rounded-2xl border bg-card p-3 pr-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift">
                    <span className={cn("flex w-16 shrink-0 flex-col items-center rounded-xl py-2", r.match.status === "published" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
                      <span className="font-display text-3xl leading-none">{new Date(r.match.starts_at).toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Asia/Dhaka" })}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(r.match.starts_at).toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Dhaka" })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-2xl leading-none">{r.match.title}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">{fmtDate(r.match.starts_at)} · {fmtTime(r.match.starts_at)}{r.match.location?.name ? ` · ${r.match.location.name}` : ""}</span>
                    </span>
                    {r.guest_count > 0 && <Badge variant="secondary">+{r.guest_count}</Badge>}
                    <Badge variant={statusVariant[r.match.status]} className="hidden sm:inline-flex">{statusLabel[r.match.status]}</Badge>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card p-12 text-center">
              <Football className="ball-bounce size-12" />
              <p className="mt-5 font-display text-3xl">No fixtures yet</p>
              <p className="mt-1 text-sm text-muted-foreground">You haven't joined a match yet.</p>
              <Button variant="accent" className="mt-5" asChild><Link to="/">Find one<ArrowUpRight /></Link></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
