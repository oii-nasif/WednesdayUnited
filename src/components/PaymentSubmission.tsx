import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { paymentSettingsQuery } from "@/lib/payments";
import { invalidateMoney, submitPayment, type PaymentPurpose } from "@/lib/ledger";
import { MAX_PAYMENT, money, validateReceipt } from "@/lib/payment-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const submit = useMutation({
    mutationFn: () => submitPayment({ userId, purpose, matchId, goalId, amount, transactionId, file, minAmount }),
    onSuccess: () => { toast.success("Payment submitted for review"); setTransactionId(""); setFile(null); setFileKey((key) => key + 1); invalidateMoney(qc); onSubmitted?.(); },
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
    {settings.payment_method === "qr" && settings.qr_code_path && <PaymentQr path={settings.qr_code_path} />}
    {settings.instructions && <p className="mb-4 whitespace-pre-wrap break-words text-sm">{settings.instructions}</p>}
      </div>
    {canSubmit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-amount`}>Amount (৳)</Label><Input id={`${id}-amount`} type="number" min={minAmount || 0.01} max={MAX_PAYMENT} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /><p className="text-xs text-muted-foreground">Up to {money(MAX_PAYMENT)} per payment.</p></div>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-tx`}>Transaction ID</Label><Input id={`${id}-tx`} required maxLength={120} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor={`${id}-receipt`} className="flex items-center gap-2"><Upload className="h-4 w-4" />Screenshot (optional, up to 1 MB)</Label><Input key={fileKey} id={`${id}-receipt`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const next = e.target.files?.[0]; if (!next) { setFile(null); return; } try { validateReceipt(next); setFile(next); } catch (error) { toast.error((error as Error).message); setFile(null); setFileKey((key) => key + 1); } }} /></div>
      <Button type="submit" variant="accent" className="w-full" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : submitLabel}</Button>
    </form>}
    </div>
  </section>;
}
