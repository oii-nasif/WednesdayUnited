import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HandHeart, Upload } from "lucide-react";
import { paymentSettingsQuery } from "@/lib/payments";
import { donationGoalsQuery, invalidateMoney, submitPayment, type DonationGoal, type PaymentPurpose } from "@/lib/ledger";
import { MAX_PAYMENT, money, validateReceipt } from "@/lib/payment-rules";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PaymentQr } from "@/components/PaymentQr";

type Props = {
  userId: string;
  purpose?: PaymentPurpose;
  matchId?: string | undefined;
  goalId?: string | undefined;
  // Minimum the database accepts (a match prepayment); `suggestedAmount` only pre-fills the form.
  requiredAmount?: number;
  suggestedAmount?: number;
  title?: string;
  submitLabel?: string;
  canSubmit?: boolean;
  bare?: boolean;
  // Side by side on wide screens: payment details left, the form right. Stacks on phones.
  split?: boolean;
  onSubmitted?: () => void;
};

export function PaymentSubmission({ userId, purpose = "match", matchId, goalId, requiredAmount = 0, suggestedAmount, title = "Prepayment", submitLabel = "Submit payment", canSubmit = true, bare = false, split = false, onSubmitted }: Props) {
  const { data: settings, isLoading, error } = useQuery(paymentSettingsQuery);
  const initial = Math.min(MAX_PAYMENT, suggestedAmount ?? requiredAmount);
  const [amount, setAmount] = useState(initial > 0 ? String(initial) : "");
  const [transactionId, setTransactionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const qc = useQueryClient();
  const minAmount = Math.min(requiredAmount, MAX_PAYMENT);
  // Match and balance payments can carry a donation to an active fund on the same transfer.
  const offerDonation = canSubmit && purpose !== "donation";
  const { data: goals = [] } = useQuery({ ...donationGoalsQuery, enabled: offerDonation });
  const [donating, setDonating] = useState(false);
  const [donation, setDonation] = useState("100");
  const [donationGoal, setDonationGoal] = useState("");
  const goal = goals.find((g) => g.id === donationGoal) ?? goals[0];
  const extra = offerDonation && donating && goal ? { goalId: goal.id, amount: Number(donation) } : null;
  const submit = useMutation({
    mutationFn: () => submitPayment({ userId, purpose, matchId, goalId, amount, transactionId, file, minAmount, donation: extra }),
    onSuccess: () => { toast.success(extra ? "Payment and donation submitted for review" : "Payment submitted for review"); setDonating(false); setTransactionId(""); setFile(null); setFileKey((key) => key + 1); invalidateMoney(qc); onSubmitted?.(); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading payment details…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load payment details. Please try again.</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">Payment details have not been added yet.</p>;
  const id = `${purpose}-${matchId ?? goalId ?? "balance"}`;
  return <section className={cn(!bare && "mt-5 border-t pt-5")}>
    {title && <h3 className="text-2xl">{title}</h3>}
    {requiredAmount > 0 && <p className="mt-1 font-semibold">Required: {money(requiredAmount)}</p>}
    <div className={cn(split && "grid gap-6 md:grid-cols-2 md:items-start")}>
      <div className={cn(split && "md:[&>*]:my-0")}>
    {settings.payment_method !== "qr" && <div className="my-4 text-sm"><p className="mb-2 font-semibold">Transfer to</p><dl className="space-y-2 break-words">
      <div><dt className="text-muted-foreground">Bank</dt><dd>{settings.bank_name}</dd></div>
      <div><dt className="text-muted-foreground">Account name</dt><dd>{settings.account_name}</dd></div>
      <div><dt className="text-muted-foreground">Account number</dt><dd className="font-semibold">{settings.account_number}</dd></div>
    </dl></div>}
    {settings.payment_method === "qr" && settings.qr_code_path && <PaymentQr path={settings.qr_code_path} accountNumber={settings.account_number} />}
    {settings.instructions && <p className="mb-4 whitespace-pre-wrap break-words text-sm">{settings.instructions}</p>}
      </div>
    {canSubmit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-amount`}>{extra ? "Payment amount (৳)" : "Amount (৳)"}</Label><Input id={`${id}-amount`} type="number" min={minAmount || 0.01} max={MAX_PAYMENT} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /><p className="text-xs text-muted-foreground">Up to {money(MAX_PAYMENT)} per payment.</p></div>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-tx`}>Transaction ID</Label><Input id={`${id}-tx`} required maxLength={120} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-receipt`} className="flex items-center gap-2"><Upload className="h-4 w-4" />Screenshot (optional, up to 1 MB)</Label><Input key={fileKey} id={`${id}-receipt`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const next = e.target.files?.[0]; if (!next) { setFile(null); return; } try { validateReceipt(next); setFile(next); } catch (error) { toast.error((error as Error).message); setFile(null); setFileKey((key) => key + 1); } }} /></div>
      {offerDonation && goals.length > 0 && <DonationAddOn id={id} goals={goals} goal={goal} donating={donating} onDonating={setDonating} amount={donation} onAmount={setDonation} onGoal={setDonationGoal} payment={Number(amount) || 0} />}
      <Button type="submit" variant="accent" className="w-full" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : extra && Number(amount) + Number(donation) > 0 ? `${submitLabel} · ${money(Number(amount) + Number(donation))}` : submitLabel}</Button>
    </form>}
    </div>
  </section>;
}

const DONATION_PRESETS = [50, 100, 200, 500];

function DonationAddOn({ id, goals, goal, donating, onDonating, amount, onAmount, onGoal, payment }: { id: string; goals: DonationGoal[]; goal: DonationGoal | undefined; donating: boolean; onDonating: (on: boolean) => void; amount: string; onAmount: (a: string) => void; onGoal: (id: string) => void; payment: number }) {
  const donation = Number(amount) || 0;
  const total = payment + donation;
  return <div className={cn("space-y-3 rounded-xl border border-dashed p-3 transition-colors", donating && "border-accent/60 bg-accent-soft/40")}>
    <label htmlFor={`${id}-donate`} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <Checkbox id={`${id}-donate`} checked={donating} onCheckedChange={(c) => onDonating(c === true)} />
      <HandHeart className="size-4 text-accent" />Add a donation{goals.length === 1 && goal ? ` to ${goal.title}` : ""}
    </label>
    {donating && <>
      {goals.length > 1 && <Select value={goal?.id} onValueChange={onGoal}>
        <SelectTrigger aria-label="Fund to donate to"><SelectValue /></SelectTrigger>
        <SelectContent>{goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent>
      </Select>}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Donation amount">
        {DONATION_PRESETS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={donation === n} onClick={() => onAmount(String(n))} className={cn("rounded-full border px-3 py-1 font-display text-base tabular transition", donation === n ? "border-accent bg-accent text-accent-foreground shadow" : "bg-card hover:border-accent/50")}>{money(n)}</button>
        ))}
        <Input aria-label="Custom donation amount" type="number" min={1} max={MAX_PAYMENT} step="0.01" required value={amount} onChange={(e) => onAmount(e.target.value)} className="h-8 w-24" />
      </div>
      <p className={cn("text-xs", total > MAX_PAYMENT ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {total > MAX_PAYMENT ? `Together this is ${money(total)}, over the ${money(MAX_PAYMENT)} limit for one transfer.` : <>Send one transfer of <span className="font-semibold text-foreground">{money(total)}</span>: {money(payment)} payment + {money(donation)} donation.</>}
      </p>
    </>}
  </div>;
}
