import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Wallet } from "lucide-react";
import { balanceState, money } from "@/lib/payment-rules";
import type { MatchDue } from "@/lib/ledger";
import { cn } from "@/lib/utils";

const toneClass = { due: "text-destructive", credit: "text-success", clear: "text-success" } as const;

// Big balance readout: red when the player owes, green when they're clear or in credit.
export function BalanceCard({ balance, className, children }: { balance: number; className?: string; children?: ReactNode }) {
  const state = balanceState(balance);
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-lift", state.tone === "due" ? "border-destructive/40" : "border-success/40", className)}>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><Wallet className="size-4" />My balance</p>
      <p className={cn("mt-1.5 font-display text-5xl leading-none tabular", toneClass[state.tone])}>{balance < 0 ? "−" : ""}{money(Math.abs(balance))}</p>
      <p className={cn("mt-1.5 text-sm font-semibold", toneClass[state.tone])}>{state.tone === "due" ? `You owe ${money(-balance)}. Pay it off below.` : state.tone === "credit" ? "In credit. It goes toward your next match." : "All clear. Nothing owed."}</p>
      {children}
    </section>
  );
}

export function BalanceText({ balance, className }: { balance: number; className?: string }) {
  const state = balanceState(balance);
  return <span className={cn("font-semibold tabular", toneClass[state.tone], className)}>{state.label}</span>;
}

// Paid / due icon beside a player on a played match's team sheet. Amounts only appear in the tooltip, for staff.
export function DueIcon({ due, detailed = false, className }: { due: MatchDue | undefined; detailed?: boolean; className?: string }) {
  if (!due) return null;
  const paid = due.due <= 0;
  const label = paid ? "Paid" : detailed ? `${money(due.due)} of ${money(due.charged)} still due` : "Not paid yet";
  const Icon = paid ? CircleCheck : CircleAlert;
  return <span title={label} className={cn("inline-flex", paid ? "text-success" : "text-destructive", className)}><Icon className="size-5" aria-hidden="true" /><span className="sr-only">{label}</span></span>;
}
