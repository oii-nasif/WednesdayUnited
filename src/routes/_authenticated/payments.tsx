import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Hourglass, Image, Landmark, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { paymentsQuery, paymentSettingsQuery, purposeLabel, type PaymentRow } from "@/lib/payments";
import { balanceQuery, balancesQuery, invalidateMoney, ledgerKindLabel, ledgerQuery, payableMatchesQuery, recordAdjustment, type LedgerEntry } from "@/lib/ledger";
import { MAX_PAYMENT, money } from "@/lib/payment-rules";
import { fmtDate, fmtTime } from "@/lib/matches";
import { BalanceCard, BalanceText } from "@/components/Balance";
import { BallFund } from "@/components/BallFund";
import { BankSettings } from "@/components/BankSettings";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayerPicker } from "@/components/PlayerPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [
    { title: "Payments — Wednesday United" },
    { name: "description", content: "Your Wednesday United balance, payments, match costs and the match ball fund." },
    { property: "og:title", content: "Payments — Wednesday United" },
    { property: "og:description", content: "Your balance, payments and match costs." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Sign in to view payments");
    await context.queryClient.ensureQueryData(paymentsQuery(data.user.id));
    return { userId: data.user.id };
  },
  component: Payments,
});

function Payments() {
  const { userId } = Route.useLoaderData();
  const { isStaff, isAdmin } = useAuth();
  const { data: mine } = useSuspenseQuery(paymentsQuery(userId));
  const { data: balance = 0 } = useQuery(balanceQuery(userId));
  const { data: myLedger } = useQuery(ledgerQuery(userId));
  const { data: team, isLoading, error } = useQuery({ ...paymentsQuery(userId, true), enabled: isStaff });
  const awaiting = mine.filter((p) => p.status === "pending" && p.purpose !== "donation").reduce((sum, p) => sum + Number(p.amount), 0);
  const [paying, setPaying] = useState(false);
  const due = balance < 0 ? -balance : 0;
  return <div className="page-enter">
    <PageHeader compact kicker="Contributions" title={<>Pay<span className="text-accent">ments</span></>} actions={isStaff ? <BankSettings /> : undefined}>
      Your balance, what each match cost you, and what you've paid.
    </PageHeader>
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <div className="relative z-10 -mt-6 mb-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <BalanceCard balance={balance} ledger={myLedger ?? []}>
          {awaiting > 0 && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Hourglass className="size-4 text-accent" />{money(awaiting)} awaiting verification</p>}
          {paying
            ? <div className="mt-2"><PayForm userId={userId} due={due} /><Button variant="ghost" className="mt-2 w-full" onClick={() => setPaying(false)}>Cancel</Button></div>
            : <Button variant={due ? "destructive" : "accent"} className="mt-4 w-full" onClick={() => setPaying(true)}>{due ? `Pay ${money(Math.min(due, MAX_PAYMENT))}` : <><Plus />Pay in advance</>}</Button>}
          <p className="mt-2 text-xs text-muted-foreground">Match costs are split per head after each game, guests included, and come off this balance.</p>
        </BalanceCard>
        <BallFund userId={userId} staff={isStaff} />
      </div>
      <Tabs defaultValue="mine">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="mine">My payments</TabsTrigger>
          <TabsTrigger value="ledger">My transactions</TabsTrigger>
          {isStaff && <>
            <TabsTrigger value="team">Payment reviews{team ? ` (${team.filter((p) => p.status === "pending").length})` : ""}</TabsTrigger>
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="transactions">All transactions</TabsTrigger>
          </>}
        </TabsList>
        <TabsContent value="mine" className="mt-5"><PaymentTable rows={mine} staff={false} /></TabsContent>
        <TabsContent value="ledger" className="mt-5"><LedgerTable rows={myLedger ?? []} staff={false} /></TabsContent>
        {isStaff && <>
          <TabsContent value="team" className="mt-5">{error ? <p className="text-destructive">Could not load payment reviews.</p> : isLoading ? <p className="text-muted-foreground">Loading payments…</p> : <PaymentTable rows={team ?? []} staff />}</TabsContent>
          <TabsContent value="balances" className="mt-5"><TeamBalances /></TabsContent>
          <TabsContent value="transactions" className="mt-5"><TeamLedger /></TabsContent>
        </>}
      </Tabs>
    </div>
  </div>;
}

// Players choose what the payment is for. A chosen match is paid off first; "My balance" goes to the oldest due.
function PayForm({ userId, due }: { userId: string; due: number }) {
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
    <PaymentSubmission key={target} userId={userId} purpose={target === "balance" ? "advance" : "match"} matchId={target === "balance" ? undefined : target} requiredAmount={upcoming?.prepayment ?? 0} suggestedAmount={suggested} title="" submitLabel="Submit payment" bare />
  </div>;
}

function PaymentTable({ rows, staff }: { rows: PaymentRow[]; staff: boolean }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<{ id: string; decision: "verified" | "rejected"; amount: number; purpose: PaymentRow["purpose"] } | null>(null);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!review) return;
      const { error } = await supabase.rpc("review_payment", { payment_id: review.id, decision: review.decision, note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment reviewed"); setReview(null); setNote(""); invalidateMoney(qc); },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const openReceipt = async (path: string) => {
    setOpening(path);
    try {
      const { data, error } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 300);
      if (error) throw error;
      setReceipt(data.signedUrl);
    } catch { toast.error("Could not open screenshot"); } finally { setOpening(null); }
  };
  const visible = rows.filter((p) => (filter === "all" || p.status === filter) && `${p.transaction_id} ${p.profile?.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="mb-4 flex flex-wrap gap-3">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search payments" placeholder="Search transaction ID or player" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44" aria-label="Payment status"><SelectValue /></SelectTrigger><SelectContent>{["all", "pending", "verified", "rejected"].map((status) => <SelectItem key={status} value={status}>{status === "all" ? "All statuses" : status[0]?.toUpperCase() + status.slice(1)}</SelectItem>)}</SelectContent></Select>
    </div>
    {visible.length === 0 ? <div className="border-y py-12 text-center text-muted-foreground">{rows.length ? "No matching payments." : <>No payments yet.{!staff && <> <Link to="/" className="text-primary underline">View matches</Link></>}</>}</div> : <div className="overflow-x-auto border-y">
      <table className="stack-table w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{staff && <th className="p-3">Player</th>}<th className="p-3">For</th><th className="p-3">Amount</th><th className="p-3">Transaction</th><th className="p-3">Status</th><th className="p-3">Review / receipt</th></tr></thead>
        <tbody className="divide-y">{visible.map((p) => <tr key={p.id}>
          {staff && <td data-label="Player" className="p-3"><Link to="/players/$id" params={{ id: p.user_id }} className="hover:text-primary hover:underline">{p.profile?.full_name ?? "Player"}</Link></td>}
          <td data-label="For" className="p-3">{p.match_id ? <><Link to="/matches/$id" params={{ id: p.match_id }} className="text-primary hover:underline">{p.match ? fmtDate(p.match.starts_at) : "Match"}</Link><p className="text-xs text-muted-foreground">{p.match?.location?.name ?? "Venue TBA"}</p></> : <span className="font-medium">{purposeLabel[p.purpose]}</span>}</td>
          <td data-label="Amount" className="whitespace-nowrap p-3 font-semibold">{money(Number(p.amount))}</td>
          <td data-label="Transaction" className="max-w-48 break-words p-3">{p.transaction_id}<p className="mt-1 text-xs text-muted-foreground">{fmtDate(p.created_at)} · {fmtTime(p.created_at)}</p></td>
          <td data-label="Status" className="p-3"><Badge variant={p.status === "verified" ? "default" : p.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>{p.review_note && <p className="mt-2 max-w-52 break-words text-xs text-muted-foreground">{p.review_note}</p>}</td>
          <td className="p-3"><div className="flex gap-1">{p.receipt_path && <Button variant="outline" size="icon" aria-label="View screenshot" title="View screenshot" disabled={opening === p.receipt_path} onClick={() => { if (p.receipt_path) openReceipt(p.receipt_path); }}><Image className="h-4 w-4" /></Button>}{staff && p.status === "pending" && <><Button size="icon" variant="outline" aria-label="Verify payment" title="Verify payment" onClick={() => { setReview({ id: p.id, decision: "verified", amount: Number(p.amount), purpose: p.purpose }); setNote(""); }}><Check className="h-4 w-4 text-success" /></Button><Button size="icon" variant="outline" aria-label="Reject payment" title="Reject payment" onClick={() => { setReview({ id: p.id, decision: "rejected", amount: Number(p.amount), purpose: p.purpose }); setNote(""); }}><X className="h-4 w-4 text-destructive" /></Button></>}</div></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <Dialog open={!!review} onOpenChange={(open) => { if (!open && !mutation.isPending) setReview(null); }}><DialogContent><DialogHeader><DialogTitle>{review?.decision === "verified" ? "Verify payment?" : "Reject payment?"}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{review?.decision === "verified" ? `Confirm that ${money(review.amount)} has reached the designated account. ${review.purpose === "donation" ? "It will be added to the fund." : "It will be credited to the player's balance."}` : "The player will see your rejection reason. Nothing is credited."}</p>
      <Label htmlFor="review-note">{review?.decision === "rejected" ? "Rejection reason" : "Note (optional)"}</Label><Textarea id="review-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      <DialogFooter><Button variant="ghost" disabled={mutation.isPending} onClick={() => setReview(null)}>Back</Button><Button disabled={mutation.isPending || (review?.decision === "rejected" && !note.trim())} variant={review?.decision === "rejected" ? "destructive" : "default"} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Confirm"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Payment screenshot</DialogTitle></DialogHeader>{receipt && <img src={receipt} alt="Submitted payment screenshot" className="max-h-[70vh] w-full object-contain" />}</DialogContent></Dialog>
  </>;
}

// Every credit and debit, newest first. Amounts are signed: green adds to the balance, red takes from it.
function LedgerTable({ rows, staff }: { rows: LedgerEntry[]; staff: boolean }) {
  if (!rows.length) return <div className="border-y py-12 text-center text-muted-foreground">No transactions yet. Match costs and verified payments show up here.</div>;
  return <div className="overflow-x-auto border-y">
    <table className="stack-table w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">Date</th>{staff && <th className="p-3">Player</th>}<th className="p-3">Type</th><th className="p-3">Details</th><th className="p-3 text-right">Amount</th></tr></thead>
      <tbody className="divide-y">{rows.map((e) => <tr key={e.id}>
        <td data-label="Date" className="whitespace-nowrap p-3">{fmtDate(e.created_at)}<p className="text-xs text-muted-foreground">{fmtTime(e.created_at)}</p></td>
        {staff && <td data-label="Player" className="p-3"><Link to="/players/$id" params={{ id: e.user_id }} className="hover:text-primary hover:underline">{e.profile?.full_name ?? "Player"}</Link></td>}
        <td data-label="Type" className="p-3"><Badge variant={e.kind === "match_charge" ? "outline" : "secondary"}>{ledgerKindLabel[e.kind]}</Badge></td>
        <td data-label="Details" className="max-w-72 break-words p-3">{e.match_id ? <Link to="/matches/$id" params={{ id: e.match_id }} className="text-primary hover:underline">{e.match?.title ?? "Match"}</Link> : null}{e.note && <p className={cn("text-xs text-muted-foreground", !e.match_id && "text-sm text-foreground")}>{e.note}</p>}</td>
        <td data-label="Amount" className={cn("whitespace-nowrap p-3 text-right font-semibold tabular", e.amount < 0 ? "text-destructive" : "text-success")}>{e.amount < 0 ? "−" : "+"}{money(Math.abs(e.amount))}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function TeamLedger() {
  const { data, isLoading, error } = useQuery(ledgerQuery(null));
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  if (error) return <p className="text-destructive">Could not load transactions.</p>;
  if (isLoading) return <p className="text-muted-foreground">Loading transactions…</p>;
  const visible = (data ?? []).filter((e) => (kind === "all" || e.kind === kind) && `${e.profile?.full_name ?? ""} ${e.note ?? ""} ${e.match?.title ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="mb-4 flex flex-wrap gap-3">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search transactions" placeholder="Search player, match or note" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Select value={kind} onValueChange={setKind}><SelectTrigger className="w-44" aria-label="Transaction type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(ledgerKindLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
    </div>
    <LedgerTable rows={visible} staff />
  </>;
}

// Who owes what, biggest dues first, with a quick way to record cash handed over at the pitch.
function TeamBalances() {
  const { data, isLoading, error } = useQuery(balancesQuery);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("due");
  const [adjusting, setAdjusting] = useState<{ id: string; name: string } | null>(null);
  if (error) return <p className="text-destructive">Could not load balances.</p>;
  if (isLoading) return <p className="text-muted-foreground">Loading balances…</p>;
  const rows = data ?? [];
  const owed = rows.filter((b) => b.balance < 0).reduce((n, b) => n - b.balance, 0);
  const visible = rows.filter((b) => (filter === "all" || (filter === "due" ? b.balance < 0 : b.balance > 0)) && (b.full_name ?? "").toLowerCase().includes(search.toLowerCase()));
  return <>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search players" placeholder="Search players" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44" aria-label="Balance filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due">Owes money</SelectItem><SelectItem value="credit">In credit</SelectItem><SelectItem value="all">Everyone</SelectItem></SelectContent></Select>
      <p className="text-sm text-muted-foreground"><span className="font-semibold text-destructive">{money(owed)}</span> owed by {rows.filter((b) => b.balance < 0).length} players</p>
    </div>
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3">
      <p className="text-sm font-semibold">Record cash or adjust any player</p>
      <PlayerPicker players={rows.map((b) => ({ id: b.user_id, full_name: b.full_name }))} value="" onChange={(id) => { const b = rows.find((x) => x.user_id === id); if (b) setAdjusting({ id: b.user_id, name: b.full_name ?? "Player" }); }} placeholder="Search a player by name" label="Adjust a player" className="w-64 max-w-full" />
    </div>
    {!visible.length ? <div className="border-y py-12 text-center text-muted-foreground">{filter === "due" ? "Nobody owes anything." : "No players match."}</div> : <ul className="divide-y border-y">{visible.map((b) => (
      <li key={b.user_id} className="flex flex-wrap items-center gap-4 py-4">
        <Avatar className="size-10"><AvatarImage src={b.avatar_url ?? undefined} /><AvatarFallback>{(b.full_name ?? "P").slice(0, 1)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1"><Link to="/players/$id" params={{ id: b.user_id }} className="font-semibold hover:text-primary hover:underline">{b.full_name ?? "Player"}</Link>{b.last_activity && <p className="text-xs text-muted-foreground">Last activity {fmtDate(b.last_activity)}</p>}</div>
        <BalanceText balance={b.balance} />
        <Button variant="outline" size="sm" onClick={() => setAdjusting({ id: b.user_id, name: b.full_name ?? "Player" })}>Record cash / adjust</Button>
      </li>
    ))}</ul>}
    <AdjustmentDialog key={adjusting?.id ?? "none"} player={adjusting} onClose={() => setAdjusting(null)} />
  </>;
}

function AdjustmentDialog({ player, onClose }: { player: { id: string; name: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const n = Number(amount);
      if (!player) throw new Error("Choose a player");
      if (!(n > 0)) throw new Error("Enter an amount above zero");
      return recordAdjustment(player.id, direction === "credit" ? n : -n, note);
    },
    onSuccess: () => { toast.success("Balance updated"); invalidateMoney(qc); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return <Dialog open={!!player} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">Adjust balance</DialogTitle><DialogDescription>{player?.name}. Every adjustment is logged with your name.</DialogDescription></DialogHeader>
      <form id="adjust-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Adjustment type">
          {([["credit", "Cash received / refund", "Adds to balance"], ["debit", "Charge", "Takes from balance"]] as const).map(([value, label, hint]) => (
            <button key={value} type="button" role="radio" aria-checked={direction === value} onClick={() => setDirection(value)} className={cn("rounded-xl border p-3 text-left text-sm transition", direction === value ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40")}>
              <span className="block font-semibold">{label}</span><span className={cn("text-xs", direction === value ? "text-primary-foreground/80" : "text-muted-foreground")}>{hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5"><Label htmlFor="adjust-amount">Amount (৳)</Label><Input id="adjust-amount" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="adjust-note">Note (optional)</Label><Textarea id="adjust-note" maxLength={500} placeholder="e.g. Paid cash at the pitch" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </form>
      <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" form="adjust-form" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

