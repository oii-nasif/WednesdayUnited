import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { matchesQuery } from "@/lib/matches";
import { MatchCard } from "@/components/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";

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
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-6 text-5xl">Match history</h1>
      {isLoading ? (
        <Skeleton className="h-52 rounded-xl" />
      ) : data && data.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => <MatchCard key={m.id} match={m} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No completed matches yet.
        </div>
      )}
    </div>
  );
}
