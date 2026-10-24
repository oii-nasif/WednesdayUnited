import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Heart, PartyPopper } from "lucide-react";
import { donationGoalsQuery } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Football } from "@/components/Football";
import { PitchLines } from "@/components/PitchLines";

// Slim strip above the hero for the active donation goal, so every visitor sees what the squad is raising for.
export function DonationBanner() {
  const { user } = useAuth();
  const { data: goals = [] } = useQuery(donationGoalsQuery);
  const goal = goals[0];
  if (!goal || goal.target_amount <= 0) return null;
  const collected = goal.collected_amount;
  const needed = Math.max(0, goal.target_amount - collected);
  const pct = Math.min(100, Math.round((collected / goal.target_amount) * 100));
  const funded = needed === 0;
  return (
    <section aria-label="Donation goal" className="relative overflow-hidden bg-accent text-accent-foreground">
      <PitchLines className="text-white/15" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 items-center gap-3 md:w-72 md:shrink-0">
          <Football className="ball-bounce size-9 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-foreground/75">Squad fundraiser</p>
            <h2 className="truncate font-display text-2xl leading-none">{goal.title} fund</h2>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span><strong className="font-display text-xl leading-none tabular">{money(collected)}</strong> <span className="text-accent-foreground/80">of {money(goal.target_amount)}</span></span>
            <span className="font-semibold">{funded ? <span className="flex items-center gap-1.5"><PartyPopper className="size-4" />Fully funded!</span> : `${money(needed)} to go`}</span>
          </div>
          <div className="mt-1.5 h-3 rounded-full bg-black/20 p-0.5" role="progressbar" aria-valuemin={0} aria-valuenow={pct} aria-valuemax={100} aria-label={`${goal.title} fund ${pct}% funded`}>
            <div className="relative h-full min-w-3 rounded-full bg-white transition-[width] duration-1000" style={{ width: `${pct}%` }}>
              <Football className="absolute -right-2 top-1/2 size-4 -translate-y-1/2" />
            </div>
          </div>
        </div>
        {!funded && <Button className="shrink-0 bg-pitch-deep text-pitch-foreground hover:bg-pitch-deep/90" asChild><Link to={user ? "/payments" : "/auth"}><Heart />Donate now<ArrowUpRight /></Link></Button>}
      </div>
    </section>
  );
}
