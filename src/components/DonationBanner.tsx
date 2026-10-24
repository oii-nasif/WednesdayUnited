import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Heart, PartyPopper } from "lucide-react";
import { donationGoalsQuery } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Football } from "@/components/Football";
import { PitchLines } from "@/components/PitchLines";

// Home-page spotlight for the active donation goal, so every visitor sees what the squad is raising for.
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
    <section className="mx-auto max-w-6xl px-4 pt-10" aria-label="Donation goal">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-deep via-pitch to-pitch-deep p-6 text-pitch-foreground shadow-lift ring-1 ring-accent/40 sm:p-8 md:p-10">
        <PitchLines className="text-white/[0.07]" />
        <Football className="ball-bounce pointer-events-none absolute -right-4 -top-4 size-24 rotate-12 opacity-90 md:right-10 md:top-8 md:size-32" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
          <div className="pr-20 md:pr-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-accent" /></span>
              Squad fundraiser
            </p>
            <h2 className="mt-3 break-words text-5xl leading-[0.9] sm:text-6xl">{goal.title}<span className="text-accent"> fund</span></h2>
            <p className="mt-3 max-w-sm text-sm text-pitch-foreground/75">Every taka moves the ball closer to the goal. Chip in and help the Wednesday crew play on.</p>
          </div>
          <div>
            <div className="flex items-end justify-between gap-3">
              <p className="font-display text-5xl leading-none tabular text-accent">{money(collected)}</p>
              <p className="pb-1 text-right text-sm text-pitch-foreground/70">of <span className="font-semibold text-pitch-foreground">{money(goal.target_amount)}</span></p>
            </div>
            <div className="mt-4 h-5 rounded-full bg-white/15 p-0.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.title} fund ${pct}% funded`}>
              <div className="relative h-full min-w-4 rounded-full bg-gradient-to-r from-accent to-success transition-[width] duration-1000" style={{ width: `${pct}%` }}>
                <Football className="absolute -right-2.5 top-1/2 size-6 -translate-y-1/2 drop-shadow-md" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">{funded ? <span className="flex items-center gap-2 text-accent"><PartyPopper className="size-4" />Fully funded. Thank you, squad!</span> : <>{money(needed)} to go · {pct}% there</>}</p>
              {!funded && <Button variant="accent" asChild><Link to={user ? "/payments" : "/auth"}><Heart />Donate now<ArrowUpRight /></Link></Button>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
