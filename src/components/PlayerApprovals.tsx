import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search, UserCheck, X } from "lucide-react";
import { squadPlayersQuery, decidePlayerApproval, type ApprovalDecision, type ApprovalStatus } from "@/lib/approval";
import { fmtDate } from "@/lib/matches";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

const FILTERS: { value: ApprovalStatus; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

// Staff review of new sign-ups. Decisions go through the staff-checked RPC; the database enforces who may decide.
export function PlayerApprovals() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(squadPlayersQuery);
  const [filter, setFilter] = useState<ApprovalStatus>("pending");
  const [search, setSearch] = useState("");
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ApprovalDecision }) => decidePlayerApproval(id, decision),
    onSuccess: (_d, { decision }) => { toast.success(decision === "approved" ? "Player approved. They can join matches now." : "Request rejected."); qc.invalidateQueries({ queryKey: squadPlayersQuery.queryKey }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, data?.players.filter((p) => p.approval_status === f.value).length ?? 0])) as Record<ApprovalStatus, number>, [data]);
  const visible = (data?.players ?? []).filter((p) => p.approval_status === filter && `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading players…</p>;
  if (error) return <p className="py-10 text-center text-sm text-destructive">Could not load players.</p>;
  if (!data?.available) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed bg-card p-8 text-center">
        <UserCheck className="mx-auto size-8 text-primary" />
        <p className="mt-3 font-display text-3xl">Player approvals are almost ready</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">They switch on once the database update is applied. Until then new sign-ups can join matches as before.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filter players">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}
              className={cn("flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all", filter === f.value ? "border-pitch bg-pitch text-pitch-foreground shadow-md" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              {f.label}<span className={cn("rounded-full px-1.5 text-[11px] tabular", f.value === "pending" && counts.pending ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground")}>{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" /><Input aria-label="Search players" placeholder="Search name or email" className="rounded-full pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {visible.length ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
          {visible.map((p) => {
            const name = p.full_name ?? p.email ?? "New player";
            const busy = decide.isPending && decide.variables?.id === p.id;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar className="size-11"><AvatarImage src={p.avatar_url ?? undefined} alt="" /><AvatarFallback className="bg-primary font-semibold text-primary-foreground">{name.slice(0, 1)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.email ?? "No email"} · signed up {fmtDate(p.created_at)}</p>
                </div>
                {p.approval_status !== "pending" && <Badge variant={p.approval_status === "approved" ? "secondary" : "destructive"}>{p.approval_status}{p.approved_at ? ` · ${fmtDate(p.approved_at)}` : ""}</Badge>}
                <div className="flex gap-2">
                  {p.approval_status !== "approved" && <Button size="sm" disabled={busy} onClick={() => decide.mutate({ id: p.id, decision: "approved" })}><Check />Approve</Button>}
                  {p.approval_status !== "rejected" && <Button size="sm" variant="outline" disabled={busy} onClick={() => decide.mutate({ id: p.id, decision: "rejected" })}><X />{p.approval_status === "approved" ? "Revoke" : "Reject"}</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card p-10 text-center">
          <Football className="ball-bounce size-10" />
          <p className="mt-4 font-display text-2xl">{filter === "pending" ? "No one waiting" : `No ${filter} players`}</p>
          <p className="mt-1 text-sm text-muted-foreground">{filter === "pending" ? "New sign-ups will appear here for approval." : "Try another filter or search."}</p>
        </div>
      )}
    </div>
  );
}
