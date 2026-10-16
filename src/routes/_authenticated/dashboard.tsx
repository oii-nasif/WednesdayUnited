import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime } from "@/lib/matches";
import { Badge } from "@/components/ui/badge";
import { statusVariant, statusLabel } from "@/components/MatchCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
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
      const { data, error } = await supabase
        .from("registrations")
        .select("id, guest_count, match:matches(id, title, starts_at, status, location:locations(name, area))")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).sort((a, b) => (b.match?.starts_at ?? "").localeCompare(a.match?.starts_at ?? ""));
    },
  });
  const attended = data?.filter((r) => r.match?.status === "completed").length ?? 0;
  const guests = data?.reduce((n, r) => n + r.guest_count, 0) ?? 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-5xl">Hey, {(user?.user_metadata?.['full_name'] as string | undefined)?.split(" ")[0] ?? "player"}</h1>
      <p className="mt-1 text-sm capitalize text-muted-foreground">{roles.map((r) => r.replace("_", " ")).join(" · ")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[["Registrations", data?.length ?? 0], ["Matches attended", attended], ["Guests brought", guests]].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className="font-display text-5xl text-primary">{v}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-3xl">My matches</h2>
      {data && data.length ? (
        <ul className="divide-y rounded-xl border bg-card">
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
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          You haven't joined a match yet. <Link to="/" className="text-primary underline">Find one</Link>
        </div>
      )}
      <p className="mt-8 text-xs text-muted-foreground">Balance and payment history arrive in the next phase.</p>
    </div>
  );
}
