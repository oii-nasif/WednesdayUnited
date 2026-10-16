import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { paymentSettingsQuery } from "@/lib/payments";
import { money, paymentSchema, validateReceipt } from "@/lib/payment-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentSubmission({ matchId, userId, requiredAmount, canSubmit = true }: { matchId: string; userId: string; requiredAmount: number; canSubmit?: boolean }) {
  const { data: settings, isLoading, error } = useQuery(paymentSettingsQuery);
  const [amount, setAmount] = useState(requiredAmount ? String(requiredAmount) : "");
  const [transactionId, setTransactionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: async () => {
      const parsed = paymentSchema.safeParse({ amount, transaction_id: transactionId });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check payment details");
      if (parsed.data.amount < requiredAmount) throw new Error(`Pay at least ${money(requiredAmount)} for you and your guests`);
      let path: string | null = null;
      if (file) {
        validateReceipt(file);
        const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
        path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("payment-receipts").upload(path, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("payments").insert({ ...parsed.data, user_id: userId, match_id: matchId, receipt_path: path });
      if (error) {
        if (path) await supabase.storage.from("payment-receipts").remove([path]);
        throw new Error(error.code === "23505" ? "This transaction ID has already been submitted" : error.message);
      }
    },
    onSuccess: () => { toast.success("Payment submitted for review"); setTransactionId(""); setFile(null); setFileKey((key) => key + 1); qc.invalidateQueries({ queryKey: ["payments"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading payment details…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load bank details. Please try again.</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">Bank details have not been added yet.</p>;
  return <section className="mt-5 border-t pt-5">
    <h3 className="text-2xl">Prepayment</h3>
    {requiredAmount > 0 && <p className="mt-1 font-semibold">Required: {money(requiredAmount)}</p>}
    <dl className="my-4 space-y-2 break-words text-sm">
      <div><dt className="text-muted-foreground">Bank</dt><dd>{settings.bank_name}</dd></div>
      <div><dt className="text-muted-foreground">Account name</dt><dd>{settings.account_name}</dd></div>
      <div><dt className="text-muted-foreground">Account number</dt><dd className="font-semibold">{settings.account_number}</dd></div>
    </dl>
    {settings.instructions && <p className="mb-4 whitespace-pre-wrap break-words text-sm">{settings.instructions}</p>}
    {canSubmit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
      <div className="grid gap-1.5"><Label htmlFor="payment-amount">Amount (৳)</Label><Input id="payment-amount" type="number" min={requiredAmount || 0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="transaction-id">Transaction ID</Label><Input id="transaction-id" required maxLength={120} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="payment-receipt" className="flex items-center gap-2"><Upload className="h-4 w-4" />Screenshot (optional)</Label><Input key={fileKey} id="payment-receipt" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const next = e.target.files?.[0]; if (!next) { setFile(null); return; } try { validateReceipt(next); setFile(next); } catch (error) { toast.error((error as Error).message); setFile(null); setFileKey((key) => key + 1); } }} /></div>
      <Button type="submit" variant="accent" className="w-full" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit payment"}</Button>
    </form>}
  </section>;
}