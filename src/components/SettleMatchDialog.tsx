import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateMoney, settleMatch } from "@/lib/ledger";
import { money, splitCost } from "@/lib/payment-rules";
import { GuestStepper } from "@/components/GuestStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export type SettleTarget = {
  id: string;
  title: string;
  total_cost: number | null;
  registrations: { user_id: string; guest_count: number; profile: { full_name: string | null } | null }[];
};
type Row = { user_id: string; name: string; guest_count: number };

// Marking a match played: staff confirm who actually played (add, remove, fix guests) and the total cost. The database
// updates the team sheet, splits the cost per head and charges everyone in one step. On a played match this edits it.
export function SettleMatchDialog({ match, onClose }: { match: SettleTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = match?.total_cost != null;
  const [total, setTotal] = useState(match?.total_cost != null ? String(match.total_cost) : "");
  const [rows, setRows] = useState<Row[]>(() => (match?.registrations ?? []).map((r) => ({ user_id: r.user_id, name: r.profile?.full_name ?? "Player", guest_count: r.guest_count })));
  const [adding, setAdding] = useState("");
  const { data: players } = useQuery({
    queryKey: ["profiles"],
    enabled: !!match,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const heads = rows.reduce((n, r) => n + 1 + r.guest_count, 0);
  const perHead = splitCost(Number(total), heads);
  const available = (players ?? []).filter((p) => !rows.some((r) => r.user_id === p.id));
  const update = (id: string, guest_count: number) => setRows((all) => all.map((r) => (r.user_id === id ? { ...r, guest_count } : r)));
  const add = (id: string) => {
    const p = players?.find((x) => x.id === id);
    if (p) setRows((all) => [...all, { user_id: p.id, name: p.full_name ?? p.email ?? "Player", guest_count: 0 }]);
    setAdding("");
  };
  const settle = useMutation({
    mutationFn: () => {
      if (!match) throw new Error("Choose a match");
      if (!rows.length) throw new Error("Add the players who played");
      if (!(Number(total) > 0)) throw new Error("Enter the total cost");
      return settleMatch(match.id, Number(total), rows.map(({ user_id, guest_count }) => ({ user_id, guest_count })));
    },
    onSuccess: (charged) => { toast.success(`${editing ? "Settlement updated" : "Marked played"}: ${money(charged)} per head`); invalidateMoney(qc); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={!!match} onOpenChange={(o) => { if (!o && !settle.isPending) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">{editing ? "Edit settlement" : "Mark played"}</DialogTitle>
        <DialogDescription>{match?.title}. Confirm who played and the total cost (pitch, balls, water…). It's split equally per head, guests included, and charged to each player's balance.{editing && " Saving replaces the current charges."}</DialogDescription>
      </DialogHeader>
      <form id="settle-form" className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); settle.mutate(); }}>
        <Label htmlFor="settle-total">Total cost (৳)</Label>
        <Input id="settle-total" type="number" min={1} step="0.01" autoFocus value={total} onChange={(e) => setTotal(e.target.value)} />
      </form>
      <section className="rounded-xl border">
        <div className="flex items-baseline justify-between border-b bg-secondary/40 px-4 py-3">
          <span className="text-sm font-semibold">Who played · {heads} head{heads === 1 ? "" : "s"}</span>
          <span className="text-sm text-muted-foreground"><span className="font-display text-2xl text-foreground tabular">{money(perHead)}</span> per head</span>
        </div>
        {rows.length ? <ul className="max-h-72 divide-y overflow-y-auto">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <GuestStepper value={r.guest_count} onChange={(n) => update(r.user_id, n)} label={`Guests for ${r.name}`} />
              <span className="w-20 text-right text-sm font-semibold tabular">{money(perHead * (1 + r.guest_count))}</span>
              <Button type="button" size="icon" variant="ghost" className="text-destructive" title={`Remove ${r.name}`} aria-label={`Remove ${r.name}`} onClick={() => setRows((all) => all.filter((x) => x.user_id !== r.user_id))}><Trash2 /></Button>
            </li>
          ))}
        </ul> : <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nobody yet. Add the players who played.</p>}
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <UserPlus className="size-4 shrink-0 text-muted-foreground" />
          <Select value={adding} onValueChange={add}>
            <SelectTrigger className="flex-1" aria-label="Add a player"><SelectValue placeholder="Add a player who played" /></SelectTrigger>
            <SelectContent>{available.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Prepayments and credit already on players' balances count toward their share.</p>
      <DialogFooter><Button variant="ghost" disabled={settle.isPending} onClick={onClose}>Cancel</Button><Button type="submit" form="settle-form" variant="accent" disabled={settle.isPending || !rows.length || !(perHead > 0)}>{settle.isPending ? "Saving…" : editing ? "Save settlement" : "Mark played and charge"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
