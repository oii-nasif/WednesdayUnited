import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LogIn, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApproval } from "@/lib/approval";
import { canJoinWithApproval } from "@/lib/approval-rules";
import { balanceQuery } from "@/lib/ledger";
import { balanceState, money } from "@/lib/payment-rules";
import { PayBalanceButton } from "@/components/PayBalance";
import { PitchLines } from "@/components/PitchLines";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const verdict = { due: "Owing", credit: "In credit", clear: "Paid up" } as const;

// Home page money panel: signed-in players see their balance and can pay from here; visitors get a sign-in prompt.
export function HomeBalance() {
  const { user, isStaff, loading } = useAuth();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="relative overflow-hidden rounded-3xl bg-accent px-8 py-10 text-accent-foreground md:px-14 md:py-12">
        <PitchLines className="text-white/15" />
        <div className="relative">
          {loading ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-foreground/80">Your balance</p>
          ) : user ? (
            <SignedIn userId={user.id} isStaff={isStaff} />
          ) : (
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent-foreground/80">Your balance</p>
                <p className="mt-2 font-display text-5xl leading-none md:text-6xl">Sign in to see your balance.</p>
                <p className="mt-3 max-w-xl text-accent-foreground/85">Check what you owe or have in credit, and pay for your games in a few taps.</p>
              </div>
              <Button size="lg" className="shrink-0 bg-white text-accent shadow-lg hover:bg-white/90" asChild><Link to="/auth"><LogIn />Sign in</Link></Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SignedIn({ userId, isStaff }: { userId: string; isStaff: boolean }) {
  const { data: balance, isLoading, error } = useQuery(balanceQuery(userId));
  const approval = useApproval();
  const canPay = canJoinWithApproval(approval.data ?? null, isStaff);
  const state = balanceState(balance ?? 0);
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-foreground/80"><Wallet className="size-3.5" />Your balance</p>
        {error ? (
          <p className="mt-2 font-display text-4xl leading-none">Couldn't load your balance.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className={cn("font-display text-6xl leading-none tabular md:text-7xl", isLoading && "animate-pulse opacity-60")}>{isLoading ? "৳…" : `${(balance ?? 0) < 0 ? "−" : ""}${money(Math.abs(balance ?? 0))}`}</p>
            {!isLoading && <span className="-rotate-6 rounded-md border-[3px] border-current px-2 py-0.5 font-display text-lg uppercase tracking-[0.15em]">{verdict[state.tone]}</span>}
          </div>
        )}
        <p className="mt-3 max-w-xl text-accent-foreground/85">
          {isLoading || error ? "Match costs are split per head after each game and come off this balance." : state.tone === "due" ? `You owe ${money(-(balance ?? 0))}. Clear it before the next kick-off.` : state.tone === "credit" ? "You're in credit. It goes toward your next match." : "All clear. Top up in advance to cover your next games."}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:w-64">
        {canPay ? (
          <PayBalanceButton userId={userId} balance={balance ?? 0} className={cn("h-11 bg-white shadow-lg hover:bg-white/90", state.tone === "due" ? "text-destructive" : "text-accent")} />
        ) : !approval.isPending && (
          <p className="text-sm text-accent-foreground/85">Payments open once a moderator approves your account.</p>
        )}
        <Link to="/payments" className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-accent-foreground/90 hover:text-accent-foreground hover:underline">Payment history<ArrowRight className="size-4" /></Link>
      </div>
    </div>
  );
}
