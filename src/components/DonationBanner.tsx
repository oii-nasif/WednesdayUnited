import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Heart, PartyPopper } from "lucide-react";
import { donationGoalsQuery } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/CountUp";
import { FundPitch } from "@/components/FundPitch";

// Strip above the hero for the active donation goal: raised vs target around a pitch-shaped progress bar.
export function DonationBanner() {
  const { user } = useAuth();
  const { data: goals = [] } = useQuery({ ...donationGoalsQuery, enabled: !!user, refetchInterval: 15_000 });
  const goal = goals[0];
  if (!goal || goal.target_amount <= 0) return null;
  const collected = goal.collected_amount;
  const needed = Math.max(0, goal.target_amount - collected);
  const pct = Math.min(100, Math.round((collected / goal.target_amount) * 100));
  const funded = needed === 0;
  return (
    <section aria-label="Donation goal" className="relative overflow-hidden bg-pitch-deep text-pitch-foreground">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-success to-accent" />
      <div className="pointer-events-none absolute -left-20 top-1/2 size-56 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 items-center gap-3 md:w-60 md:shrink-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground shadow-[0_0_16px_var(--accent)]"><Heart className="size-5 animate-pulse" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Road to goal</p>
            <h2 className="truncate font-display text-2xl leading-none">{goal.title}</h2>
          </div>
        </div>
        <div className="min-w-0 flex-1 md:pr-2">
          <div className="mb-2 flex items-end justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-pitch-foreground/60">
            <p>Raised <span className="ml-1 font-display text-xl normal-case tracking-normal text-accent tabular"><CountUp value={collected} format={(n) => money(Math.round(n))} /></span></p>
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-display text-sm normal-case tracking-wider text-pitch-foreground ring-1 ring-white/15 tabular">{pct}% funded</span>
            <p className="text-right">Target <span className="ml-1 font-display text-xl normal-case tracking-normal text-pitch-foreground tabular">{money(goal.target_amount)}</span></p>
          </div>
          <FundPitch pct={pct} label={`${goal.title} fund ${pct}% funded`} />
        </div>
        {funded
          ? <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent md:self-center"><PartyPopper className="size-4" />Back of the net!</span>
          : <Button variant="accent" className="shrink-0 md:self-center" asChild><Link to={user ? "/payments" : "/auth"}><Heart />{money(needed)} to go<ArrowUpRight /></Link></Button>}
      </div>
    </section>
  );
}
