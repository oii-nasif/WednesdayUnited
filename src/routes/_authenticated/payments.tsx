import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Image, Landmark, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { paymentsQuery, paymentSettingsQuery, type PaymentRow } from "@/lib/payments";
import { money, verifiedTotal } from "@/lib/payment-rules";
import { fmtDate, fmtTime } from "@/lib/matches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [
    { title: "Payments — Wednesday United" },
    { name: "description", content: "Your prepayments, verified contributions and Wednesday United payment history." },
    { property: "og:title", content: "Payments — Wednesday United" },
    { property: "og:description", content: "Your prepayments and verified contributions." },
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
  const { data: team, isLoading, error } = useQuery({ ...paymentsQuery(userId, true), enabled: isStaff });
  const pending = mine.filter((p) => p.status === "pending");
  return <div className="mx-auto max-w-6xl px-4 py-10 page-enter">
    <p className="mb-2 text-xs font-semibold uppercase text-primary">Wednesday United / Contributions</p>
    <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-5xl">Payments</h1>{isAdmin && <BankSettings />}</div>
    <div className="my-8 grid gap-6 border-y py-6 sm:grid-cols-3">
      <div><p className="text-sm text-muted-foreground">Verified contributions</p><p className="mt-2 font-display text-4xl text-success">{money(verifiedTotal(mine))}</p></div>
      <div><p className="text-sm text-muted-foreground">Awaiting verification</p><p className="mt-2 font-display text-4xl text-accent">{money(pending.reduce((sum, p) => sum + Number(p.amount), 0))}</p></div>
      <div><p className="text-sm text-muted-foreground">Payments submitted</p><p className="mt-2 font-display text-4xl text-primary">{mine.length}</p></div>
    </div>
    <Tabs defaultValue="mine">
      <TabsList><TabsTrigger value="mine">My history</TabsTrigger>{isStaff && <TabsTrigger value="team">Payment reviews{team ? ` (${team.filter((p) => p.status === "pending").length})` : ""}</TabsTrigger>}</TabsList>
      <TabsContent value="mine" className="mt-5"><PaymentTable rows={mine} staff={false} /></TabsContent>
      {isStaff && <TabsContent value="team" className="mt-5">{error ? <p className="text-destructive">Could not load payment reviews.</p> : isLoading ? <p className="text-muted-foreground">Loading payments…</p> : <PaymentTable rows={team ?? []} staff />}</TabsContent>}
    </Tabs>
  </div>;
}

function PaymentTable({ rows, staff }: { rows: PaymentRow[]; staff: boolean }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [review, setReview] = useState<{ id: string; decision: "verified" | "rejected"; amount: number } | null>(null);
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
    onSuccess: () => { toast.success("Payment reviewed"); setReview(null); setNote(""); qc.invalidateQueries({ queryKey: ["payments"] }); },
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
      <table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{staff && <th className="p-3">Player</th>}<th className="p-3">Match</th><th className="p-3">Amount</th><th className="p-3">Transaction</th><th className="p-3">Status</th><th className="p-3">Review / receipt</th></tr></thead>
        <tbody className="divide-y">{visible.map((p) => <tr key={p.id}>
          {staff && <td className="p-3">{p.profile?.full_name ?? "Player"}</td>}
          <td className="p-3"><Link to="/matches/$id" params={{ id: p.match_id }} className="text-primary hover:underline">{p.match ? fmtDate(p.match.starts_at) : "Match"}</Link><p className="text-xs text-muted-foreground">{p.match?.location?.name ?? "Venue TBA"}</p></td>
          <td className="whitespace-nowrap p-3 font-semibold">{money(Number(p.amount))}</td>
          <td className="max-w-48 break-words p-3">{p.transaction_id}<p className="mt-1 text-xs text-muted-foreground">{fmtDate(p.created_at)} · {fmtTime(p.created_at)}</p></td>
          <td className="p-3"><Badge variant={p.status === "verified" ? "default" : p.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>{p.review_note && <p className="mt-2 max-w-52 break-words text-xs text-muted-foreground">{p.review_note}</p>}</td>
          <td className="p-3"><div className="flex gap-1">{p.receipt_path && <Button variant="outline" size="icon" aria-label="View screenshot" title="View screenshot" disabled={opening === p.receipt_path} onClick={() => { if (p.receipt_path) openReceipt(p.receipt_path); }}><Image className="h-4 w-4" /></Button>}{staff && p.status === "pending" && <><Button size="icon" variant="outline" aria-label="Verify payment" title="Verify payment" onClick={() => { setReview({ id: p.id, decision: "verified", amount: Number(p.amount) }); setNote(""); }}><Check className="h-4 w-4 text-success" /></Button><Button size="icon" variant="outline" aria-label="Reject payment" title="Reject payment" onClick={() => { setReview({ id: p.id, decision: "rejected", amount: Number(p.amount) }); setNote(""); }}><X className="h-4 w-4 text-destructive" /></Button></>}</div></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <Dialog open={!!review} onOpenChange={(open) => { if (!open && !mutation.isPending) setReview(null); }}><DialogContent><DialogHeader><DialogTitle>{review?.decision === "verified" ? "Verify payment?" : "Reject payment?"}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{review?.decision === "verified" ? `Confirm that ${money(review.amount)} has reached the designated account.` : "The player will see your rejection reason. This payment will not count toward their contributions."}</p>
      <Label htmlFor="review-note">{review?.decision === "rejected" ? "Rejection reason" : "Note (optional)"}</Label><Textarea id="review-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      <DialogFooter><Button variant="ghost" disabled={mutation.isPending} onClick={() => setReview(null)}>Back</Button><Button disabled={mutation.isPending || (review?.decision === "rejected" && !note.trim())} variant={review?.decision === "rejected" ? "destructive" : "default"} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : "Confirm"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Payment screenshot</DialogTitle></DialogHeader>{receipt && <img src={receipt} alt="Submitted payment screenshot" className="max-h-[70vh] w-full object-contain" />}</DialogContent></Dialog>
  </>;
}

function BankSettings() {
  const { data: settings, error, isLoading } = useQuery(paymentSettingsQuery);
  const [form, setForm] = useState<{ bank_name: string; account_name: string; account_number: string; instructions: string } | null>(null);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const row = { bank_name: form.bank_name.trim(), account_name: form.account_name.trim(), account_number: form.account_number.trim(), instructions: form.instructions.trim(), updated_at: new Date().toISOString() };
      const { error } = settings ? await supabase.from("payment_settings").update(row).eq("id", settings.id) : await supabase.from("payment_settings").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bank details saved"); setForm(null); qc.invalidateQueries({ queryKey: ["payment-settings"] }); },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  return <><Button variant="outline" disabled={isLoading || !!error} onClick={() => setForm({ bank_name: settings?.bank_name ?? "", account_name: settings?.account_name ?? "", account_number: settings?.account_number ?? "", instructions: settings?.instructions ?? "" })}><Landmark className="mr-2 h-4 w-4" />Bank details</Button>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !save.isPending) setForm(null); }}><DialogContent><DialogHeader><DialogTitle>Designated bank account</DialogTitle></DialogHeader>{form && <form id="bank-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {([ ["bank_name", "Bank name"], ["account_name", "Account holder"], ["account_number", "Account number"] ] as const).map(([key, label]) => <div key={key} className="grid gap-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} required maxLength={120} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}
      <div className="grid gap-1.5"><Label htmlFor="bank-instructions">Payment instructions</Label><Textarea id="bank-instructions" maxLength={2000} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
    </form>}<DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={() => setForm(null)}>Close</Button><Button form="bank-form" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}