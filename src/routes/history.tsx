import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { matchesQuery } from "@/lib/matches";
import { MatchCard } from "@/components/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarX, Search, Trophy, Users } from "lucide-react";
import { participantCount } from "@/lib/matches";
import { PageHeader, Stat } from "@/components/PageHeader";
import { CountUp } from "@/components/CountUp";
import { Football } from "@/components/Football";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Match History — Wednesday United" },
      { name: "description", content: "Past Wednesday United matches and attendance." },
      { property: "og:title", content: "Match History — Wednesday United" },
      { property: "og:description", content: "Past Wednesday United matches and attendance." },
    ],
  }),
  component: History,
});

function History() {
  const { data, isLoading } = useQuery(matchesQuery("history"));
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const visible = (data ?? []).filter((m) => (status === "all" || m.status === status) && `${m.title} ${m.location?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const played = (data ?? []).filter((m) => m.status === "completed");
  return (
    <div className="page-enter">
      <PageHeader kicker="The archive" title={<>Match <span className="text-accent">history</span></>}>
        Every Wednesday we've played, and the ones the weather won.
      </PageHeader>
      <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card px-1 py-5 shadow-lift sm:p-6">
          <div className="px-3 sm:px-6"><Stat icon={<Trophy />} label="Games played" value={<CountUp value={played.length} />} /></div>
          <div className="px-3 sm:px-6"><Stat icon={<Users />} tone="accent" label="Total appearances" value={<CountUp value={played.reduce((n, m) => n + participantCount(m.registrations), 0)} />} /></div>
          <div className="px-3 sm:px-6"><Stat icon={<CalendarX />} label="Called off" value={<CountUp value={(data?.length ?? 0) - played.length} />} /></div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3"><Tabs value={status} onValueChange={setStatus}><TabsList><TabsTrigger value="all">All games</TabsTrigger><TabsTrigger value="completed">Played</TabsTrigger><TabsTrigger value="cancelled">Cancelled</TabsTrigger></TabsList></Tabs><div className="relative w-full sm:w-72"><Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" /><Input aria-label="Search past matches" placeholder="Search the archive" className="rounded-full pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
        ) : visible.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {visible.map((m, i) => <div key={m.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}><MatchCard match={m} /></div>)}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card p-12 text-center">
            <Football className="ball-bounce size-12" />
            <p className="mt-5 font-display text-3xl">{search || status !== "all" ? "No matching games" : "No past matches yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{search || status !== "all" ? "Try a different filter or search." : "Results will appear here after the first final whistle."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
