import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Check, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtTime, participantCount, guestCount, spotsLabel, joinMatch, quickJoinState } from "@/lib/matches";
import { useAuth } from "@/lib/auth";
import { useApproval } from "@/lib/approval";
import { canJoinWithApproval } from "@/lib/approval-rules";
import { money, prepaymentTotal } from "@/lib/payment-rules";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

type Props = {
  match: {
    id: string;
    title: string;
    starts_at: string;
    status: string;
    player_limit: number | null;
    registration_deadline: string | null;
    prepayment_required: boolean;
    prepayment_amount: number | null;
    location: { name: string; area: string | null } | null;
    registrations: { user_id: string; guest_count: number }[];
  };
};

export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "accent"> = {
  published: "accent",
  draft: "secondary",
  completed: "default",
  cancelled: "destructive",
};

export const statusLabel: Record<string, string> = { published: "Game On", draft: "Draft", completed: "Played", cancelled: "Cancelled" };

const stubTone: Record<string, string> = {
  published: "bg-primary text-primary-foreground",
  draft: "bg-muted-foreground text-primary-foreground",
  completed: "bg-pitch text-pitch-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const dhaka = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "Asia/Dhaka" });

// Capacity track with a ball marking how full the match is; the ball spins while the card is hovered.
export function CapacityBar({ total, limit, className }: { total: number; limit: number; className?: string }) {
  const pct = Math.min(100, (total / limit) * 100);
  return (
    <div role="progressbar" aria-label="Match capacity" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={total} className={cn("relative mx-2 h-1.5 rounded-full bg-secondary", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", pct >= 100 ? "bg-accent" : "bg-gradient-to-r from-primary to-primary/70")} style={{ width: `${pct}%` }} />
      <Football className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 drop-shadow transition-[left] duration-700 group-hover:animate-spin group-hover:[animation-duration:1.2s]" style={{ left: `${pct}%` }} />
    </div>
  );
}

// Matchday ticket: a coloured date stub, punched notches and a perforated tear line before the details.
export function MatchCard({ match }: Props) {
  const total = participantCount(match.registrations);
  const date = new Date(match.starts_at);
  const spots = match.status === "published" ? spotsLabel(total, match.player_limit) : null;
  const tight = !!match.player_limit && match.player_limit - total <= 3;
  const over = match.status === "completed" || match.status === "cancelled";
  return (
    <div className="group relative rounded-2xl drop-shadow-[0_10px_18px_oklch(0.3_0.1_262/0.12)] transition-[filter,translate] duration-300 hover:-translate-y-1 hover:drop-shadow-[0_22px_30px_oklch(0.3_0.12_262/0.22)]">
      <Link
        to="/matches/$id"
        params={{ id: match.id }}
        aria-label={`${match.title} match details`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      />
      <div className="ticket pointer-events-none relative flex min-h-full overflow-hidden rounded-2xl bg-card [--notch:88px]">
        <div className={cn("relative flex w-[88px] shrink-0 flex-col items-center justify-center gap-0.5 py-5", stubTone[match.status])}>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">{dhaka(date, { weekday: "short" })}</span>
          <span className="font-display text-5xl leading-none">{dhaka(date, { day: "2-digit" })}</span>
          <span className="text-xs font-bold uppercase tracking-widest">{dhaka(date, { month: "short" })}</span>
          <span className="perforation absolute inset-y-3 right-0 w-0.5 opacity-60" />
        </div>
        <div className="relative min-w-0 flex-1 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={statusVariant[match.status]}>{statusLabel[match.status]}</Badge>
              {spots && <span className={cn("text-[11px] font-bold uppercase tracking-wider", tight ? "text-accent" : "text-muted-foreground")}>{spots}</span>}
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-all duration-300 group-hover:rotate-45 group-hover:bg-accent group-hover:text-accent-foreground">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
          <h3 className={cn("mt-2 break-words text-3xl leading-[0.95]", match.status === "cancelled" && "text-muted-foreground line-through decoration-2")}>{match.title}</h3>
          <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Clock className="size-4 shrink-0 text-primary" />Kick-off {fmtTime(match.starts_at)}</span>
            <span className="flex min-w-0 items-center gap-2"><MapPin className="size-4 shrink-0 text-primary" /><span className="truncate">{match.location ? `${match.location.name}${match.location.area ? `, ${match.location.area}` : ""}` : "Venue TBA"}</span></span>
          </div>
          {match.player_limit && !over && <CapacityBar total={total} limit={match.player_limit} className="mt-5" />}
          <div className="mt-4 flex items-center gap-2 border-t border-dashed pt-3 text-sm">
            <Users className="size-4 text-accent" />
            <span className="font-bold tabular">{total}{match.player_limit ? <span className="text-muted-foreground">/{match.player_limit}</span> : ""}</span>
            <span className="truncate text-muted-foreground">{over ? "played" : "playing"} · {guestCount(match.registrations)} guests</span>
            <QuickJoin match={match} />
          </div>
          {over && (
            <span className={cn("pointer-events-none absolute bottom-4 right-4 -rotate-12 rounded-md border-2 px-2 py-0.5 font-display text-xl tracking-wider opacity-80", match.status === "completed" ? "border-primary text-primary" : "border-destructive text-destructive")}>
              {match.status === "completed" ? "Full time" : "Called off"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// One-tap join from the card, with no guests; guests and payment are handled on the match page.
function QuickJoin({ match }: Props) {
  const { user, isStaff } = useAuth();
  const approval = useApproval();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const state = quickJoinState(match, { userId: user?.id, canJoin: canJoinWithApproval(approval.data ?? null, isStaff), isStaff });
  const join = useMutation({
    mutationFn: () => joinMatch(match.id, user!.id),
    onSuccess: () => {
      const due = match.prepayment_required ? prepaymentTotal(Number(match.prepayment_amount ?? 0), 0) : 0;
      toast.success(`You're in for ${match.title}!`, due ? {
        description: `Prepayment of ${money(due)} is due.`,
        action: { label: "Pay now", onClick: () => navigate({ to: "/matches/$id", params: { id: match.id } }) },
      } : undefined);
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["match", match.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Could not join this match"),
  });

  if (state === "joined") {
    return <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-success"><Check className="size-3.5" />You're in</span>;
  }
  if (state !== "join") return null;
  return (
    <Button size="sm" variant="accent" className="group/join pointer-events-auto relative ml-auto shrink-0" disabled={join.isPending} onClick={() => join.mutate()}>
      <Football className={join.isPending ? "size-4 animate-spin" : "size-4 transition-transform duration-500 group-hover/join:rotate-[360deg]"} />
      {join.isPending ? "Joining…" : "Join"}
    </Button>
  );
}
