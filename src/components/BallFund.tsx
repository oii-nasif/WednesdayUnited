import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Pencil, PartyPopper, Plus } from "lucide-react";
import { donationGoalsQuery, invalidateMoney, saveDonationGoal, createDonationGoal, type DonationGoal } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { CountUp } from "@/components/CountUp";
import { FundShot } from "@/components/FundShot";
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
  return (
    <section className="relative overflow-hidden rounded-2xl bg-pitch-deep text-pitch-foreground shadow-lift ring-1 ring-white/10">
      {/* Scoreboard: raised vs target, read like a half-time score. */}
      <div className="bg-gradient-to-r from-pitch via-pitch-deep to-pitch px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><Heart className="size-4 animate-pulse" />Fundraiser</p>
            <h3 className="mt-1 break-words text-3xl leading-none">{goal.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-success" /></span>Live</span>
            {staff && <Button size="icon" variant="ghost" className="size-8 text-pitch-foreground/80 hover:bg-white/10 hover:text-pitch-foreground" title="Edit fund" aria-label="Edit fund" onClick={() => setEditing(true)}><Pencil /></Button>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-xl bg-black/30 px-4 py-3 text-center ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/60">Raised</p>
            <p className="mt-1 font-display text-4xl leading-none text-accent tabular sm:text-5xl"><CountUp value={collected} format={(n) => money(Math.round(n))} /></p>
          </div>
          <span className="font-display text-3xl text-pitch-foreground/40">:</span>
          <div className="rounded-xl bg-black/30 px-4 py-3 text-center ring-1 ring-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/60">Target</p>
            <p className="mt-1 font-display text-4xl leading-none tabular sm:text-5xl">{money(goal.target_amount)}</p>
          </div>
        </div>
      </div>
      <div className="px-6 pb-6">
        <FundShot pct={pct} label={`${goal.title} fund ${pct}% funded`} className="mt-2 text-pitch-foreground" />
        <p className="mt-3 text-center text-sm font-semibold">{funded ? <span className="flex items-center justify-center gap-2 text-accent"><PartyPopper className="size-4" />Back of the net. Thank you, squad!</span> : <>{money(needed)} from goal · <span className="text-accent">{pct}%</span> of the way</>}</p>
        {!funded && (donating
          ? <div className="mt-4 rounded-xl bg-card p-4 text-card-foreground"><PaymentSubmission userId={userId} purpose="donation" goalId={goal.id} title="" submitLabel="Send donation" bare /><Button variant="ghost" className="mt-2 w-full" onClick={() => setDonating(false)}>Cancel</Button></div>
          : <Button variant="accent" size="lg" className="mt-4 w-full" onClick={() => setDonating(true)}><Heart />Kick it closer</Button>)}
      </div>
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
