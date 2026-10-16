import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/hero.jpg";
import { matchesQuery, fmtDate, fmtTime } from "@/lib/matches";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
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
  const { user } = useAuth();
  const next = data?.[0];
  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={hero} alt="Night football under floodlights" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-pitch-foreground md:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">After office · every week</p>
          <h1 className="mt-3 max-w-2xl text-6xl leading-[0.9] md:text-8xl">Wednesday United</h1>
          {next ? (
            <p className="mt-5 max-w-xl text-lg text-pitch-foreground/85">
              Next up: <strong>{next.title}</strong> — {fmtDate(next.starts_at)}, {fmtTime(next.starts_at)}
              {next.location ? ` at ${next.location.name}` : ""}.
            </p>
          ) : (
            <p className="mt-5 max-w-xl text-lg text-pitch-foreground/85">Colleagues. Floodlights. One ball.</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {next && (
              <Button variant="accent" size="lg" asChild>
                <Link to="/matches/$id" params={{ id: next.id }}>View next match</Link>
              </Button>
            )}
            {!user && (
              <Button variant="secondary" size="lg" asChild>
                <Link to="/auth">Sign in to play</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="relative h-2 stripe-accent" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-4xl">Upcoming matches</h2>
          <Link to="/history" className="text-sm font-medium text-primary hover:text-accent">Past matches →</Link>
        </div>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : data && data.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No matches scheduled yet. Check back soon.
          </div>
        )}
      </section>
    </div>
  );
}
