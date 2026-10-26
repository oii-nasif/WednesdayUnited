import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Receipt, Trophy, Wallet } from "lucide-react";
import { balanceState, money } from "@/lib/payment-rules";
import type { LedgerEntry, MatchDue } from "@/lib/ledger";
import { cn } from "@/lib/utils";

const toneClass = { due: "text-destructive", credit: "text-success", clear: "text-success" } as const;
const stubTone = { due: "bg-destructive text-destructive-foreground", credit: "bg-success text-white", clear: "bg-success text-white" } as const;
const stamp = { due: "OWING", credit: "IN CREDIT", clear: "PAID UP" } as const;

// Season-ticket stub: the balance on the coloured stub, a rubber stamp for the verdict,
// and the season so far (paid, matches charged, last match) on the tear-off half.
export function BalanceCard({ balance, ledger = [], className, children }: { balance: number; ledger?: LedgerEntry[]; className?: string; children?: ReactNode }) {
  const state = balanceState(balance);
  const paid = ledger.filter((e) => e.kind === "payment").reduce((s, e) => s + e.amount, 0);
  const charges = ledger.filter((e) => e.kind === "match_charge");
  const last = charges[0];
  return (
    <section className={cn("ticket flex overflow-hidden rounded-2xl bg-card shadow-lift [--notch:128px] sm:[--notch:160px]", className)}>
      <div className={cn("relative flex w-[128px] shrink-0 flex-col items-center justify-center gap-1 px-2 py-5 text-center sm:w-[160px]", stubTone[state.tone])}>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80"><Wallet className="size-3.5" />Balance</span>
        <span className="whitespace-nowrap font-display text-3xl leading-none tabular sm:text-4xl">{balance < 0 ? "−" : ""}{money(Math.abs(balance))}</span>
        <span key={state.tone} className="stamp mt-2 -rotate-6 rounded-md border-[3px] border-current px-2 py-0.5 font-display text-sm uppercase tracking-[0.15em]">{stamp[state.tone]}</span>
        <span className="perforation absolute inset-y-3 right-0 w-0.5 opacity-60" />
      </div>
      <div className="min-w-0 flex-1 p-5">
        <p className={cn("text-sm font-semibold", toneClass[state.tone])}>{state.tone === "due" ? `You owe ${money(-balance)}. Pay it off below.` : state.tone === "credit" ? "In credit. It goes toward your next match." : "All clear. Nothing owed."}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Receipt, label: "Paid in", value: money(paid) },
            { icon: Trophy, label: "Matches billed", value: String(charges.length) },
            { icon: CircleCheck, label: "Last match", value: last ? money(-last.amount) : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0 rounded-xl bg-secondary/60 px-2 py-2">
              <dt className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Icon className="size-3" />{label}</dt>
              <dd className="mt-0.5 truncate font-display text-xl leading-none tabular">{value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
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
