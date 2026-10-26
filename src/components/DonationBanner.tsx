import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandCoins, Heart, PartyPopper } from "lucide-react";
import { donationActivityQuery, donationGoalsQuery } from "@/lib/ledger";
import { paymentsQuery } from "@/lib/payments";
import { money } from "@/lib/payment-rules";
import { firstName, fundShare, fundStage, timeAgo } from "@/lib/donation-rules";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { CountUp } from "@/components/CountUp";
import { Football } from "@/components/Football";
import { FundPitch } from "@/components/FundPitch";
import { GoalCelebration } from "@/components/GoalCelebration";
import { PitchLines } from "@/components/PitchLines";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The fund panel above the hero. Three things earn attention without nagging: numbers that move (count-up, live
// ticker of who just contributed), a concrete ask ("13 players × ৳220 and it's done"), and a state that knows you
// (thanks you once you've given). Every animation is slow and stops under reduced-motion.
export function DonationBanner({ squadSize }: { squadSize?: number }) {
  const { user } = useAuth();
  const { data: goals = [] } = useQuery({ ...donationGoalsQuery, enabled: !!user, refetchInterval: 15_000 });
  const goal = goals[0];
  const { data: activity } = useQuery({ ...donationActivityQuery(goal?.id ?? ""), enabled: !!user && !!goal, refetchInterval: 30_000, retry: false });
  const { data: payments = [] } = useQuery({ ...paymentsQuery(user?.id ?? ""), enabled: !!user && !!goal });
  const pct = goal ? Math.min(100, Math.round((goal.collected_amount / goal.target_amount) * 100)) : 0;
  const [celebrate, setCelebrate] = useState(false);
  const [giving, setGiving] = useState(false);
  const lastPct = useRef<number | null>(null);
  useEffect(() => {
    if (!goal) return;
    if (lastPct.current !== null && lastPct.current < 100 && pct >= 100) setCelebrate(true);
    lastPct.current = pct;
  }, [goal, pct]);
  if (!goal || goal.target_amount <= 0) return null;

  const collected = goal.collected_amount;
  const needed = Math.max(0, goal.target_amount - collected);
  const funded = needed === 0;
  const mine = payments.filter((p) => p.purpose === "donation" && p.goal_id === goal.id);
  const given = mine.filter((p) => p.status === "verified").reduce((n, p) => n + Number(p.amount), 0);
  const pending = mine.filter((p) => p.status === "pending").reduce((n, p) => n + Number(p.amount), 0);
  const { players, share } = fundShare(needed, squadSize);
  const recent = activity?.recent ?? [];
  const donors = activity?.donor_count ?? 0;

  const lines = [
    fundStage(pct),
    ...recent.slice(0, 3).map((r) => `${firstName(r.name)} contributed ${money(r.amount)} · ${timeAgo(r.at)}`),
    donors > 0 ? `${donors} player${donors === 1 ? " has" : "s have"} contributed so far` : null,
    activity && activity.week_amount > 0 ? `${money(activity.week_amount)} raised this week` : null,
    !funded ? `${money(needed)} to go · ${players} players × ${money(share)} and it's done` : null,
    given > 0 ? `You've given ${money(given)}. Legend.` : null,
  ].filter((l): l is string => !!l);

  return (
    <section aria-label="Donation goal" className="relative overflow-hidden bg-pitch-deep text-pitch-foreground">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-success to-accent" />
      <div aria-hidden="true" className="fund-glow pointer-events-none absolute -inset-x-[10%] inset-y-0 [background:radial-gradient(45%_140%_at_8%_50%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_65%),radial-gradient(40%_140%_at_92%_50%,color-mix(in_oklab,var(--success)_16%,transparent),transparent_65%)]" />
      <PitchLines className="text-white/[0.05]" />
      <div className="relative mx-auto grid max-w-6xl gap-5 px-4 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,14rem)] md:items-center md:gap-8">
        {/* The ask */}
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-accent shadow-[0_0_28px_color-mix(in_oklab,var(--accent)_70%,transparent)]">
            <Football className="ball-spin-slow size-9 drop-shadow" />
            <span className="absolute -bottom-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-pitch-deep ring-2 ring-accent"><Heart className="size-3 fill-accent text-accent" /></span>
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Squad fundraiser
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] tracking-wider text-pitch-foreground"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-success" /></span>Live</span>
            </p>
            <h2 className="truncate font-display text-3xl leading-none sm:text-4xl">{goal.title}</h2>
            <Ticker lines={lines} />
          </div>
        </div>

        {/* Progress */}
        <div className="min-w-0">
          <div className="mb-2 flex items-end justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-pitch-foreground/60">
            <p>Raised <span className="ml-1 font-display text-2xl normal-case tracking-normal text-accent tabular"><CountUp value={collected} format={(n) => money(Math.round(n))} /></span></p>
            <span className={cn("rounded-full px-2.5 py-1 font-display text-sm normal-case tracking-wider ring-1 tabular", funded ? "bg-accent text-accent-foreground ring-accent" : "bg-white/10 text-pitch-foreground ring-white/15")}>{pct}%</span>
            <p className="text-right">Target <span className="ml-1 font-display text-2xl normal-case tracking-normal text-pitch-foreground tabular">{money(goal.target_amount)}</span></p>
          </div>
          <FundPitch pct={pct} label={`${goal.title} fund ${pct}% funded`} />
          <ol className="mt-2 grid grid-cols-3 text-[9px] font-bold uppercase tracking-[0.16em]" aria-hidden="true">
            {[["Kick-off", 0, "text-left"], ["Half-time", 50, "text-center"], ["Full-time", 100, "text-right"]].map(([label, at, align]) => (
              <li key={label} className={cn(align as string, pct >= (at as number) && (at as number) > 0 ? "text-accent" : "text-pitch-foreground/40")}>{label}</li>
            ))}
          </ol>
        </div>

        {/* The move */}
        <div className="flex flex-col gap-2.5 md:items-stretch">
          {funded ? (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-accent/15 px-3 py-3 text-sm font-semibold text-accent ring-1 ring-accent/40"><PartyPopper className="size-4" />Back of the net. Thank you, squad!</p>
          ) : (
            <Button variant="accent" size="lg" className="fund-cta h-12 w-full text-base" onClick={() => setGiving(true)}>
              <HandCoins />{given > 0 ? "Contribute again" : `Contribute ${money(share)}`}
            </Button>
          )}
          <p className="text-center text-xs text-pitch-foreground/70">
            {funded ? `${money(collected)} raised together.` : pending > 0 ? `Your ${money(pending)} is being verified.` : given > 0 ? `You've given ${money(given)}. ${money(needed)} to go.` : `${money(needed)} to go · ${players} players × ${money(share)} and it's done.`}
          </p>
          <DonorStack recent={recent} donors={donors} />
        </div>
      </div>
      {celebrate && <GoalCelebration subtitle={`${goal.title} is fully funded`} onDone={() => setCelebrate(false)} />}
      {user && <ChipInDialog open={giving} onClose={() => setGiving(false)} userId={user.id} goal={{ id: goal.id, title: goal.title }} collected={collected} target={goal.target_amount} pct={pct} share={share} />}
    </section>
  );
}

// One line that changes every few seconds. Rotation pauses on hover, and the first line is the stage summary so the
// panel still reads well before any switch happens.
function Ticker({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (lines.length < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 4200);
    return () => clearInterval(t);
  }, [lines.length, paused]);
  const line = lines[i % Math.max(1, lines.length)] ?? "";
  return (
    <p className="mt-1.5 h-5 overflow-hidden text-sm text-pitch-foreground/80" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span key={line} className="ticker-in block truncate">{line}</span>
    </p>
  );
}

// Faces of the latest donors. Social proof does more than any slogan; an empty stack becomes the first-mover hook.
function DonorStack({ recent, donors }: { recent: { name: string | null; avatar_url: string | null }[]; donors: number }) {
  if (!donors) return <p className="text-center text-xs font-semibold text-accent">Be the first to contribute</p>;
  const faces = recent.slice(0, 4);
  const names = faces.slice(0, 2).map((r) => firstName(r.name));
  const rest = donors - names.length;
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-pitch-foreground/70">
      <span className="flex -space-x-2">
        {faces.map((r, i) => (
          <Avatar key={i} className="size-6 ring-2 ring-pitch-deep"><AvatarPhoto src={r.avatar_url} /><AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{firstName(r.name).slice(0, 1)}</AvatarFallback></Avatar>
        ))}
      </span>
      <span className="truncate">{names.join(", ")}{rest > 0 ? ` +${rest} more` : ""} contributed</span>
    </div>
  );
}

// Give without leaving the page: pick a round amount or type your own, then the usual transfer form.
function ChipInDialog({ open, onClose, userId, goal, collected, target, pct, share }: { open: boolean; onClose: () => void; userId: string; goal: { id: string; title: string }; collected: number; target: number; pct: number; share: number }) {
  const needed = Math.max(0, target - collected);
  const presets = [...new Set([share, share * 2, Math.min(needed, 1000), 2000].map((n) => Math.min(2000, Math.max(50, Math.round(n)))))].filter((n) => n <= Math.max(needed, 50) || n === share).sort((a, b) => a - b).slice(0, 4);
  const [amount, setAmount] = useState(share);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Contribute to {goal.title}</DialogTitle>
          <DialogDescription>{money(collected)} raised of {money(target)} · {money(needed)} to go.</DialogDescription>
        </DialogHeader>
        <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true"><div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Amount">
          {presets.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={amount === n} onClick={() => setAmount(n)} className={cn("rounded-full border px-3.5 py-1.5 font-display text-lg tabular transition", amount === n ? "border-accent bg-accent text-accent-foreground shadow" : "hover:border-accent/50")}>{money(n)}</button>
          ))}
        </div>
        <PaymentSubmission key={amount} userId={userId} purpose="donation" goalId={goal.id} suggestedAmount={amount} title="" submitLabel="Send donation" bare split onSubmitted={onClose} />
      </DialogContent>
    </Dialog>
  );
}
