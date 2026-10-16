import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { matchesQuery } from "@/lib/matches";
import { MatchCard } from "@/components/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

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
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 page-enter">
      <p className="mb-2 text-xs font-semibold uppercase text-primary">Wednesday United / The archive</p><h1 className="mb-6 text-5xl">Match history</h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Tabs value={status} onValueChange={setStatus}><TabsList><TabsTrigger value="all">All games</TabsTrigger><TabsTrigger value="completed">Played</TabsTrigger><TabsTrigger value="cancelled">Cancelled</TabsTrigger></TabsList></Tabs><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search past matches" placeholder="Search the archive" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      {isLoading ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : visible.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => <MatchCard key={m.id} match={m} />)}
        </div>
      ) : (
        <div className="border-y p-12 text-center text-muted-foreground">
          {search || status !== "all" ? "No matching games." : "No past matches yet."}
        </div>
      )}
    </div>
  );
}
