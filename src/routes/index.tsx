import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import hero from "@/assets/hero.jpg";
import { matchesQuery, fmtDate, fmtTime, participantCount, spotsLabel } from "@/lib/matches";
import { MatchCard, CapacityBar } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Search, Users, LogIn, UserPlus, Goal } from "lucide-react";
import { KickAbout } from "@/components/KickAbout";
import { Countdown } from "@/components/Countdown";
import { CountUp } from "@/components/CountUp";
import { Football } from "@/components/Football";
import { PitchLines } from "@/components/PitchLines";
import { Moon } from "@/components/Moon";
import { DonationBanner } from "@/components/DonationBanner";
import { Kicker, SectionHeading, Stat } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

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

const STEPS = [
  { icon: LogIn, title: "Sign in", body: "One tap with Google and you're on the squad list." },
  { icon: UserPlus, title: "Grab your spot", body: "Join a fixture and bring guests. Every name lands on the pitch." },
  { icon: Goal, title: "Come and play", body: "Lace up, turn up, and enjoy the game with the team on Wednesday." },
];

function Index() {
  const { data, isLoading } = useQuery(matchesQuery("upcoming"));
  const { user, isStaff } = useAuth();
  const [search, setSearch] = useState("");
  const [venue, setVenue] = useState("all");
  const visible = (data ?? []).filter((m) => (venue === "all" || m.location_id === venue) && `${m.title} ${m.location?.name ?? ""} ${m.location?.area ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const venues = [...new Map((data ?? []).filter((m) => m.location).map((m) => [m.location_id, m.location])).entries()];
  const next = data?.[0];
  const nextTotal = next ? participantCount(next.registrations) : 0;
  const filtered = search || venue !== "all";

  return (
    <div>
      <DonationBanner squadSize={nextTotal} />
      <section className="bg-moonlight relative overflow-hidden text-pitch-foreground">
        <img src={hero} alt="" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-r from-pitch-deep/90 via-pitch/60 to-pitch/20" />
        <PitchLines className="moonrise text-white/[0.07]" />
        <Moon className="right-[20%] top-12 size-24 md:size-32" />
        <p aria-hidden="true" className="text-outline pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[22vw] leading-none text-white/[0.05]">Wednesday</p>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 pt-14 md:pb-28 md:pt-20 lg:grid-cols-[1.15fr_1fr]">
          <div className="rise">
            <Kicker className="text-pitch-foreground/75">After office · On the pitch</Kicker>
            <h1 className="mt-5 text-[5.5rem] leading-[0.82] sm:text-9xl lg:text-[9.5rem]">Wednesday<br /><span className="text-accent">United.</span></h1>
            <p className="mt-6 max-w-md text-lg text-pitch-foreground/80">The weekly game for colleagues who'd rather be on the pitch. Grab a spot, bring a mate, play under the moonlight.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {next ? (
                <Button variant="accent" size="lg" asChild><Link to="/matches/$id" params={{ id: next.id }}>Get your spot<ArrowUpRight /></Link></Button>
              ) : user ? (
                <Button variant="accent" size="lg" asChild><Link to={isStaff ? "/manage" : "/dashboard"}>{isStaff ? "Manage matches" : "My games"}<ArrowUpRight /></Link></Button>
              ) : null}
              {!user && <Button size="lg" variant="outline" className="border-white/25 bg-white/5 text-pitch-foreground hover:border-white/50 hover:bg-white/10 hover:text-pitch-foreground" asChild><Link to="/auth">Join the squad</Link></Button>}
            </div>
          </div>

          {next ? (
            <Link to="/matches/$id" params={{ id: next.id }} className="rise group relative block rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/[0.09] hover:ring-white/30 [animation-delay:150ms] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>Next kick-off</span>
                {spotsLabel(nextTotal, next.player_limit) && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{spotsLabel(nextTotal, next.player_limit)}</span>}
              </div>
              <h2 className="mt-3 text-4xl leading-none sm:text-5xl">{next.title}</h2>
              <div className="mt-4 grid gap-2 text-sm text-pitch-foreground/80 sm:grid-cols-2">
                <span className="flex items-center gap-2"><CalendarDays className="size-4 text-accent" />{fmtDate(next.starts_at)} · {fmtTime(next.starts_at)}</span>
                <span className="flex min-w-0 items-center gap-2"><MapPin className="size-4 shrink-0 text-accent" /><span className="truncate">{next.location?.name ?? "Venue TBA"}</span></span>
              </div>
              <Countdown target={next.starts_at} className="mt-6" />
              {next.player_limit && <CapacityBar total={nextTotal} limit={next.player_limit} className="mt-7 bg-white/15" />}
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-pitch-foreground/80"><Users className="size-4 text-accent" /><strong className="text-pitch-foreground">{nextTotal}</strong> on the team sheet</span>
                <span className="flex items-center gap-1 font-semibold text-accent">Details<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ) : !isLoading && (
            <div className="rise rounded-3xl bg-white/[0.06] p-8 text-center ring-1 ring-white/15 backdrop-blur-md">
              <Football className="ball-bounce mx-auto size-14" />
              <p className="mt-4 font-display text-4xl">Next fixture: TBC</p>
              <p className="mt-2 text-sm text-pitch-foreground/70">The moderators are booking the pitch. Juggle while you wait.</p>
            </div>
          )}
        </div>
        <KickAbout floorOffset={52} />
      </section>

      <section className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card px-1 py-5 shadow-lift sm:p-6">
          <div className="px-3 sm:px-6"><Stat icon={<CalendarDays />} label="Upcoming games" value={<CountUp value={data?.length ?? 0} />} /></div>
          <div className="px-3 sm:px-6"><Stat icon={<Users />} tone="accent" label="Players joined" value={<CountUp value={(data ?? []).reduce((n, m) => n + participantCount(m.registrations), 0)} />} /></div>
          <div className="px-3 sm:px-6"><Stat icon={<MapPin />} label="Match venues" value={<CountUp value={venues.length} />} /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-16">
        <SectionHeading index="01" kicker="The weekly lineup" title="Upcoming fixtures" action={<Button variant="ghost" asChild><Link to="/history">Match history<ArrowRight /></Link></Button>} />
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80"><Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" /><Input className="h-10 rounded-full pl-10" placeholder="Search matches or venues" aria-label="Search upcoming matches" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter by venue">
            {[["all", "All venues"] as const, ...venues.map(([id, v]) => [id ?? "", v?.name ?? ""] as const)].map(([id, name]) => (
              <button key={id} type="button" aria-pressed={venue === id} onClick={() => setVenue(id)}
                className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-all", venue === id ? "border-pitch bg-pitch text-pitch-foreground shadow-md" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                {name}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
        ) : visible.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((m, i) => <div key={m.id} className="rise" style={{ animationDelay: `${i * 70}ms` }}><MatchCard match={m} /></div>)}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
            <Football className="ball-bounce size-12" />
            <h3 className="mt-5 text-4xl">{filtered ? "No matches found" : "The next game is on its way"}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{filtered ? "No games match these filters." : "No matches scheduled yet."}</p>
            {filtered ? <Button variant="link" onClick={() => { setSearch(""); setVenue("all"); }}>Clear filters</Button> : isStaff ? <Button className="mt-5" asChild><Link to="/manage">Create a match<ArrowUpRight /></Link></Button> : <Button variant="link" asChild><Link to="/history">See past games<ArrowRight /></Link></Button>}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading index="02" kicker="How it works" title="Matchday routine" />
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift">
              <span aria-hidden="true" className="absolute -bottom-7 right-3 font-display text-[8rem] leading-none text-primary/[0.07] transition-colors group-hover:text-accent/20">{i + 1}</span>
              <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"><Icon className="size-5" /></span>
              <h3 className="mt-5 text-3xl">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-12 text-accent-foreground md:px-14">
          <PitchLines className="text-white/15" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-foreground/80">On the training ground</p>
            <p className="mt-2 font-display text-5xl leading-none md:text-6xl">New features are warming up.</p>
            <p className="mt-3 max-w-xl text-accent-foreground/85">Some parts of the website are still in development. Hang tight.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
