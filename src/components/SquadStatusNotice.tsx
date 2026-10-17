import { Hourglass, ShieldX } from "lucide-react";
import type { ApprovalStatus } from "@/lib/approval";
import { cn } from "@/lib/utils";

// Shown to signed-in players who aren't approved yet; renders nothing for approved players.
export function SquadStatusNotice({ status, compact, className }: { status: ApprovalStatus | null; compact?: boolean; className?: string }) {
  if (status !== "pending" && status !== "rejected") return null;
  const pending = status === "pending";
  const Icon = pending ? Hourglass : ShieldX;
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-2xl border p-4", pending ? "border-accent/30 bg-accent-soft" : "border-destructive/30 bg-destructive/5", className)}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", pending ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground")}>
        <Icon className={cn("size-5", pending && "animate-[spin_3s_ease-in-out_infinite]")} />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-none">{pending ? "Waiting for squad approval" : "Squad request not approved"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending
            ? compact ? "A moderator will approve you soon. Then you can join matches." : "Welcome! A moderator will check your sign-up soon. Until then you can browse matches and see who's playing; joining unlocks once you're approved."
            : "Your request to join the squad wasn't approved. If you think that's a mistake, please contact a moderator."}
        </p>
      </div>
    </div>
  );
}
