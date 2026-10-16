import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/hero.jpg";
import { matchesQuery, fmtDate, fmtTime } from "@/lib/matches";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Search, SlidersHorizontal, Users, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { participantCount } from "@/lib/matches";
import logo from "@/assets/wu-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Wednesday United — Upcoming Matches" },
      { name: "description", content: "See upcoming Wednesday United games, who's playing, and join the next match." },
      { property: "og:title", content: "Wednesday United — Upcoming Matches" },
      { property: "og:description", content: "See upcoming games, who's playing, and join the next match." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isLoading } = useQuery(matchesQuery("upcoming"));
  const { user, isStaff } = useAuth();
  const [search, setSearch] = useState("");
  const [venue, setVenue] = useState("all");
  const visible = (data ?? []).filter((m) => (venue === "all" || m.location_id === venue) && `${m.title} ${m.location?.name ?? ""} ${m.location?.area ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const venues = [...new Map((data ?? []).filter((m) => m.location).map((m) => [m.location_id, m.location])).entries()];
  const next = data?.[0];
  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={hero} alt="Night football under floodlights" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 text-pitch-foreground md:py-14 page-enter">
          <div className="mb-5 flex items-center gap-3"><span className="h-0.5 w-8 bg-accent" /><p className="text-xs font-semibold uppercase text-pitch-foreground/85">After office. On the pitch.</p></div>
          <h1 className="max-w-2xl text-6xl leading-[0.95] md:text-8xl">Wednesday<br />United<span className="text-accent">.</span></h1>
          {next ? (
            <div className="mt-5 space-y-2 text-sm text-pitch-foreground/85"><p className="flex items-center gap-2"><CalendarDays className="size-4 text-accent" />{fmtDate(next.starts_at)} · {fmtTime(next.starts_at)}</p><p className="flex items-center gap-2"><MapPin className="size-4 text-accent" />{next.location?.name ?? "Venue to be announced"}</p></div>
          ) : (
            <p className="mt-5 max-w-xl text-base text-pitch-foreground/85">Colleagues. Floodlights. One ball.</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {next && (
              <Button variant="accent" size="lg" asChild>
                <Link to="/matches/$id" params={{ id: next.id }}>Next match<ArrowUpRight /></Link>
              </Button>
            )}
            {!user && (
              <Button variant="secondary" size="lg" asChild>
                <Link to="/auth">Join the squad<ArrowUpRight /></Link>
              </Button>
            )}
            {user && !next && <Button variant="accent" size="lg" asChild><Link to={isStaff ? "/manage" : "/dashboard"}>{isStaff ? "Manage matches" : "My games"}<ArrowUpRight /></Link></Button>}
          </div>
        </div>
        <div className="relative h-1 bg-accent" />
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x px-4 py-5">
          <div className="flex items-center gap-3"><CalendarDays className="hidden size-5 text-primary sm:block" /><div><p className="font-display text-3xl">{data?.length ?? 0}</p><p className="text-xs text-muted-foreground">Upcoming games</p></div></div>
          <div className="flex items-center gap-3 pl-5"><Users className="hidden size-5 text-accent sm:block" /><div><p className="font-display text-3xl">{(data ?? []).reduce((n, m) => n + participantCount(m.registrations), 0)}</p><p className="text-xs text-muted-foreground">Places taken</p></div></div>
          <div className="flex items-center gap-3 pl-5"><MapPin className="hidden size-5 text-primary sm:block" /><div><p className="font-display text-3xl">{venues.length}</p><p className="text-xs text-muted-foreground">Match venues</p></div></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-9">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="mb-1 text-xs font-semibold uppercase text-primary">The weekly lineup</p><h2 className="text-4xl">Upcoming matches</h2></div>
          <Button variant="ghost" size="sm" asChild><Link to="/history">Match history<ArrowRight /></Link></Button>
        </div>
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="bg-card pl-10" placeholder="Search matches or venues" aria-label="Search upcoming matches" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={venue} onValueChange={setVenue}><SelectTrigger className="w-44 bg-card" aria-label="Filter by venue"><SlidersHorizontal className="size-4 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All venues</SelectItem>{venues.map(([id, v]) => id && v && <SelectItem key={id} value={id}>{v.name}</SelectItem>)}</SelectContent></Select>
        </div>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
          </div>
        ) : visible.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center border-y py-10 text-center"><img src={logo.url} alt="Wednesday United badge" className="mb-4 size-16 rounded-full object-cover" /><h3 className="text-3xl">{search || venue !== "all" ? "No matches found" : "The next game is on its way"}</h3><p className="mt-2 text-sm text-muted-foreground">{search || venue !== "all" ? "No games match these filters." : "No matches scheduled yet."}</p>{search || venue !== "all" ? <Button variant="link" onClick={() => { setSearch(""); setVenue("all"); }}>Clear filters</Button> : isStaff ? <Button className="mt-5" asChild><Link to="/manage">Create a match<ArrowUpRight /></Link></Button> : <Button variant="link" asChild><Link to="/history">See past games<ArrowRight /></Link></Button>}</div>
        )}
      </section>
    </div>
  );
}
