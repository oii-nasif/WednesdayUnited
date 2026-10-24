import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Pencil, PartyPopper, Plus } from "lucide-react";
import { donationGoalsQuery, invalidateMoney, saveDonationGoal, createDonationGoal, type DonationGoal } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { Football } from "@/components/Football";
import { CountUp } from "@/components/CountUp";
import { PitchLines } from "@/components/PitchLines";
import { cn } from "@/lib/utils";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

// The match ball fund: progress toward the target, so every donation visibly moves the bar.
export function BallFund({ userId, staff }: { userId: string; staff: boolean }) {
  const { data: goals = [], isLoading, error } = useQuery({ ...donationGoalsQuery, refetchInterval: 15_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const goal = goals.find((g) => g.id === selected) ?? goals[0];
  return <div className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-3xl">Donation goals</h2>
      {staff && <Button variant="outline" size="sm" onClick={() => setCreating(true)}><Plus />Create goal</Button>}
    </div>
    {isLoading ? <p className="text-sm text-muted-foreground">Loading donation goals…</p> : error ? <p className="text-sm text-destructive">Could not load donation goals.</p> : <>
      {goals.length > 1 && <div className="mb-3 grid gap-1.5"><Label htmlFor="donation-goal">Choose a fund</Label><Select value={goal?.id} onValueChange={setSelected}><SelectTrigger id="donation-goal" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent></Select></div>}
      {goal ? <FundCard key={goal.id} goal={goal} userId={userId} staff={staff} /> : <p className="py-6 text-sm text-muted-foreground">No active donation goals.</p>}
    </>}
    {staff && <EditFundDialog key={`create-${creating}`} open={creating} onOpenChange={setCreating} onCreated={setSelected} />}
  </div>;
}

function FundCard({ goal, userId, staff }: { goal: DonationGoal; userId: string; staff: boolean }) {
  const [donating, setDonating] = useState(false);
  const [editing, setEditing] = useState(false);
  const collected = goal.collected_amount;
  const needed = Math.max(0, goal.target_amount - collected);
  const pct = Math.min(100, Math.round((collected / goal.target_amount) * 100));
  const funded = needed === 0;
  // Start empty and grow to the real value, then glide whenever a refresh brings new donations.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pitch-deep via-pitch to-pitch-deep p-6 text-pitch-foreground shadow-lift ring-1 ring-accent/40">
      <PitchLines className="text-white/[0.07]" />
      <Football className="ball-spin pointer-events-none absolute -right-6 -top-6 size-28 rotate-12 opacity-90" />
      <div className="relative flex flex-wrap items-start justify-between gap-3 pr-16">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><Heart className="size-4 animate-pulse" />Donate</p>
          <h3 className="mt-1 break-words text-4xl leading-none">{goal.title}<span className="text-accent"> fund</span></h3>
        </div>
        {staff && <Button size="icon" variant="ghost" className="text-pitch-foreground/80 hover:bg-white/10 hover:text-pitch-foreground" title="Edit fund" aria-label="Edit fund" onClick={() => setEditing(true)}><Pencil /></Button>}
      </div>
      <div className="relative mt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-success" /></span>Live</span>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p><span className="font-display text-5xl leading-none text-accent tabular"><CountUp value={collected} format={(n) => money(Math.round(n))} /></span> <span className="text-sm text-pitch-foreground/70">collected</span></p>
          <p className="text-right text-sm text-pitch-foreground/70">of <span className="font-semibold text-pitch-foreground">{money(goal.target_amount)}</span></p>
        </div>
        <div className="relative mt-4">
          <div className={cn("h-5 rounded-full bg-black/30 p-0.5", pct > 0 && !funded && "fund-glow")} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.title} fund ${pct}% funded`}>
            <div className="fund-stripes relative h-full min-w-4 rounded-full bg-gradient-to-r from-accent via-[oklch(0.85_0.17_95)] to-success transition-[width] duration-[1400ms] ease-out" style={{ width: `${width}%` }}>
              {pct > 0 && <Football className="ball-spin absolute -right-2.5 top-1/2 size-6 -translate-y-1/2 drop-shadow-md" />}
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0.5 top-0 h-5">{[25, 50, 75].map((m) => <span key={m} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/30" style={{ left: `${m}%` }} />)}</div>
        </div>
        <p className="mt-3 text-sm font-semibold">{funded ? <span className="flex items-center gap-2 text-accent"><PartyPopper className="size-4" />Fully funded. Thank you, squad!</span> : <>{money(needed)} still needed · {pct}% there</>}</p>
      </div>
      {!funded && (donating
        ? <div className="relative mt-4 rounded-xl bg-card p-4 text-card-foreground"><PaymentSubmission userId={userId} purpose="donation" goalId={goal.id} title="" submitLabel="Send donation" bare /><Button variant="ghost" className="mt-2 w-full" onClick={() => setDonating(false)}>Cancel</Button></div>
        : <Button variant="accent" className="relative mt-5 w-full" onClick={() => setDonating(true)}><Heart />Donate to this fund</Button>)}
      <p className="relative mt-3 text-xs text-pitch-foreground/60">Donations don't touch your balance. They count once a moderator verifies them.</p>
      {staff && <EditFundDialog key={`${goal.id}-${editing}`} open={editing} onOpenChange={setEditing} goal={goal} />}
    </section>
  );
}

function EditFundDialog({ open, onOpenChange, goal, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; goal?: { id: string; title: string; target_amount: number }; onCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const save = useMutation({
    mutationFn: async (): Promise<string | undefined> => {
      const amount = Number(target);
      if (goal) {
        await saveDonationGoal({ id: goal.id, title, target_amount: amount });
        return undefined;
      }
      return createDonationGoal({ title, target_amount: amount });
    },
    onSuccess: (id) => { toast.success(goal ? "Fund updated" : "Donation goal created"); invalidateMoney(qc); if (id) onCreated?.(id); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={open} onOpenChange={(o) => { if (!save.isPending) onOpenChange(o); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-3xl">{goal ? "Edit fund" : "Create donation goal"}</DialogTitle><DialogDescription>{goal ? "Collected donations stay as they are." : "Existing funds stay open. Donations count after staff verification."}</DialogDescription></DialogHeader>
      <form id="fund-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid gap-1.5"><Label htmlFor="fund-title">Name</Label><Input id="fund-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="fund-target">Target (৳)</Label><Input id="fund-target" required type="number" min={0.01} max={1000000} step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
      </form>
      <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="fund-form" disabled={save.isPending}>{save.isPending ? "Saving…" : goal ? "Save" : "Create goal"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
