import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Heart, PartyPopper } from "lucide-react";
import { donationGoalsQuery } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FundPitch } from "@/components/FundPitch";

// Slim strip above the hero for the active donation goal, so every visitor sees what the squad is raising for.
export function DonationBanner() {
  const { user } = useAuth();
  const { data: goals = [] } = useQuery({ ...donationGoalsQuery, refetchInterval: 15_000 });
  const goal = goals[0];
  if (!goal || goal.target_amount <= 0) return null;
  const collected = goal.collected_amount;
  const needed = Math.max(0, goal.target_amount - collected);
  const pct = Math.min(100, Math.round((collected / goal.target_amount) * 100));
  const funded = needed === 0;
  return (
    <section aria-label="Donation goal" className="relative overflow-hidden bg-pitch-deep text-pitch-foreground">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-success to-accent" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-5">
        <div className="flex min-w-0 items-center gap-3 md:w-64 md:shrink-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Heart className="size-4" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Road to goal</p>
            <h2 className="truncate font-display text-xl leading-none">{goal.title}</h2>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 rounded-md bg-black/40 px-2.5 py-1 font-display text-lg leading-none text-accent tabular ring-1 ring-white/10">{money(collected)}</span>
          <FundPitch compact pct={pct} label={`${goal.title} fund ${pct}% funded`} className="flex-1" />
          <span className="shrink-0 rounded-md bg-black/40 px-2.5 py-1 font-display text-lg leading-none tabular ring-1 ring-white/10">{money(goal.target_amount)}</span>
        </div>
        {funded
          ? <span className="flex items-center gap-1.5 text-sm font-semibold text-accent"><PartyPopper className="size-4" />Back of the net!</span>
          : <Button variant="accent" className="shrink-0" asChild><Link to={user ? "/payments" : "/auth"}><Heart />{money(needed)} to go<ArrowUpRight /></Link></Button>}
      </div>
    </section>
  );
}
