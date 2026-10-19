import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Pencil, PartyPopper, Plus } from "lucide-react";
import { donationGoalsQuery, invalidateMoney, saveDonationGoal, createDonationGoal, type DonationGoal } from "@/lib/ledger";
import { money } from "@/lib/payment-rules";
import { Football } from "@/components/Football";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

// The match ball fund: progress toward the target, so every donation visibly moves the bar.
export function BallFund({ userId, staff }: { userId: string; staff: boolean }) {
  const { data: goals = [], isLoading, error } = useQuery(donationGoalsQuery);
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
    <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card">
      <Football className="pointer-events-none absolute -right-6 -top-6 size-28 rotate-12 opacity-10" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent"><Heart className="size-4" />Donate</p>
          <h3 className="mt-1 break-words text-4xl leading-none">{goal.title} fund</h3>
        </div>
        {staff && <Button size="icon" variant="ghost" title="Edit fund" aria-label="Edit fund" onClick={() => setEditing(true)}><Pencil /></Button>}
      </div>
      <div className="relative mt-5">
        <div className="flex items-end justify-between gap-3">
          <p><span className="font-display text-4xl leading-none text-success tabular">{money(collected)}</span> <span className="text-sm text-muted-foreground">collected</span></p>
          <p className="text-right text-sm text-muted-foreground">of <span className="font-semibold text-foreground">{money(goal.target_amount)}</span></p>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.title} fund ${pct}% funded`}>
          <div className="relative h-full rounded-full bg-gradient-to-r from-accent to-success transition-[width] duration-1000" style={{ width: `${pct}%` }}>
            {pct > 0 && <Football className="absolute -right-2 top-1/2 size-5 -translate-y-1/2" />}
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold">{funded ? <span className="flex items-center gap-2 text-success"><PartyPopper className="size-4" />Fully funded. Thank you, squad!</span> : <>{money(needed)} still needed · {pct}% there</>}</p>
      </div>
      {!funded && (donating
        ? <div className="mt-2"><PaymentSubmission userId={userId} purpose="donation" goalId={goal.id} title="" submitLabel="Send donation" bare /><Button variant="ghost" className="mt-2 w-full" onClick={() => setDonating(false)}>Cancel</Button></div>
        : <Button variant="accent" className="mt-5 w-full" onClick={() => setDonating(true)}><Heart />Donate to this fund</Button>)}
      <p className="mt-3 text-xs text-muted-foreground">Donations don't touch your balance. They count once a moderator verifies them.</p>
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
