import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { payableMatchesQuery } from "@/lib/ledger";
import { MAX_PAYMENT, money } from "@/lib/payment-rules";
import { fmtDate } from "@/lib/matches";
import { PayDialog } from "@/components/PayDialog";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// "Pay off your balance" / "Pay in advance" button and the popup behind it, shared by the payments page and home.
export function PayBalanceButton({ userId, balance, className }: { userId: string; balance: number; className?: string }) {
  const [paying, setPaying] = useState(false);
  const due = balance < 0 ? -balance : 0;
  return <>
    <Button variant={due ? "destructive" : "accent"} className={cn("w-full", className)} onClick={() => setPaying(true)}>{due ? `Pay ${money(Math.min(due, MAX_PAYMENT))}` : <><Plus />Pay in advance</>}</Button>
    <PayDialog open={paying} onClose={() => setPaying(false)} title={due ? "Pay off your balance" : "Pay in advance"} description={due ? `You owe ${money(due)}. Pick what the transfer is for, then send the details.` : "Credit goes to your balance and covers your next matches."}>
      <PayForm userId={userId} due={due} onSubmitted={() => setPaying(false)} />
    </PayDialog>
  </>;
}

// Players choose what the payment is for. A chosen match is paid off first; "My balance" goes to the oldest due.
function PayForm({ userId, due, onSubmitted }: { userId: string; due: number; onSubmitted: () => void }) {
  const { data } = useQuery(payableMatchesQuery(userId));
  const [target, setTarget] = useState("balance");
  const owing = data?.due.find((d) => d.match_id === target);
  const upcoming = data?.upcoming.find((u) => u.match_id === target);
  const suggested = owing ? owing.due : upcoming ? upcoming.prepayment : due;
  return <div className="space-y-3">
    <div className="grid gap-1.5">
      <Label htmlFor="pay-for">What are you paying for?</Label>
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger id="pay-for"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="balance">My balance{due ? ` (due ${money(due)})` : " (pay in advance)"}</SelectItem>
          {data?.due.map((d) => <SelectItem key={d.match_id} value={d.match_id}>{d.title} · {fmtDate(d.starts_at)} · due {money(d.due)}</SelectItem>)}
          {data?.upcoming.map((u) => <SelectItem key={u.match_id} value={u.match_id}>{u.title} · {fmtDate(u.starts_at)}{u.prepayment ? ` · prepay ${money(u.prepayment)}` : " · upcoming"}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <PaymentSubmission key={target} userId={userId} purpose={target === "balance" ? "advance" : "match"} matchId={target === "balance" ? undefined : target} requiredAmount={upcoming?.prepayment ?? 0} suggestedAmount={suggested} title="" submitLabel="Submit payment" bare split onSubmitted={onSubmitted} />
  </div>;
}
