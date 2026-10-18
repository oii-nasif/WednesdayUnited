import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateMoney, reopenMatch, settleMatch } from "@/lib/ledger";
import { participantCount } from "@/lib/matches";
import { money, splitCost } from "@/lib/payment-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

type SettleTarget = { id: string; title: string; registrations: { id: string; guest_count: number; profile: { full_name: string | null } | null }[] };

// Completing a match means entering what it cost; the database splits it per head and charges each player.
export function SettleMatchDialog({ match, onClose }: { match: SettleTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [total, setTotal] = useState("");
  const heads = participantCount(match?.registrations);
  const perHead = splitCost(Number(total), heads);
  const settle = useMutation({
    mutationFn: () => {
      if (!match) throw new Error("Choose a match");
      if (!(Number(total) > 0)) throw new Error("Enter the total cost");
      return settleMatch(match.id, Number(total));
    },
    onSuccess: (charged) => { toast.success(`Match settled at ${money(charged)} per head`); invalidateMoney(qc); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={!!match} onOpenChange={(o) => { if (!o && !settle.isPending) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-3xl">Complete match</DialogTitle><DialogDescription>{match?.title}. Enter the total cost (pitch, balls, water…). It's split equally across {heads} head{heads === 1 ? "" : "s"}, guests included, and charged to each player's balance.</DialogDescription></DialogHeader>
      {heads === 0 ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Nobody is on the team sheet. Add the players who played before completing the match.</p> : <>
        <form id="settle-form" className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); settle.mutate(); }}>
          <Label htmlFor="settle-total">Total cost (৳)</Label>
          <Input id="settle-total" type="number" min={1} step="0.01" autoFocus value={total} onChange={(e) => setTotal(e.target.value)} />
        </form>
        <div className="rounded-xl border bg-secondary/40 p-4">
          <p className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Per head</span><span className="font-display text-3xl tabular">{money(perHead)}</span></p>
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-sm">
            {match?.registrations.map((r) => (
              <li key={r.id} className="flex justify-between gap-3"><span className="truncate">{r.profile?.full_name ?? "Player"}{r.guest_count > 0 && <span className="text-muted-foreground"> + {r.guest_count} guest{r.guest_count > 1 ? "s" : ""}</span>}</span><span className="tabular">{money(perHead * (1 + r.guest_count))}</span></li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Prepayments and credit already on players' balances count toward their share. The team sheet is locked once the match is settled.</p>
      </>}
      <DialogFooter><Button variant="ghost" disabled={settle.isPending} onClick={onClose}>Cancel</Button><Button type="submit" form="settle-form" variant="accent" disabled={settle.isPending || heads === 0 || !(perHead > 0)}>{settle.isPending ? "Settling…" : "Complete and charge"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

// Undo a settlement: every charge is reversed (logged), and the match goes back to booked.
export function ReopenMatchDialog({ match, onClose }: { match: { id: string; title: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const reopen = useMutation({
    mutationFn: () => {
      if (!match) throw new Error("Choose a match");
      if (!reason.trim()) throw new Error("Give a reason");
      return reopenMatch(match.id, reason);
    },
    onSuccess: () => { toast.success("Match reopened and charges reversed"); invalidateMoney(qc); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={!!match} onOpenChange={(o) => { if (!o && !reopen.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">Reopen match?</DialogTitle><DialogDescription>{match?.title}. Every player's charge for this match is reversed and the team sheet unlocks, so you can fix it and complete the match again.</DialogDescription></DialogHeader>
      <form id="reopen-form" className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); reopen.mutate(); }}>
        <Label htmlFor="reopen-reason">Reason</Label>
        <Textarea id="reopen-reason" maxLength={300} placeholder="e.g. Pitch cost was entered wrong" value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
      <DialogFooter><Button variant="ghost" disabled={reopen.isPending} onClick={onClose}>Cancel</Button><Button type="submit" form="reopen-form" variant="destructive" disabled={reopen.isPending || !reason.trim()}>{reopen.isPending ? "Reopening…" : "Reopen match"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
