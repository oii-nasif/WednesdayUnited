import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { paymentSettingsQuery } from "@/lib/payments";
import { validateReceipt } from "@/lib/payment-rules";
import { uploadPaymentQr } from "@/lib/payment-qr";
import { bankSettingsInput, type BankForm, type PaymentMethod } from "@/lib/bank-settings-rules";
import { PaymentQr } from "@/components/PaymentQr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function BankSettings() {
  const { user } = useAuth();
  const { data: settings, error, isLoading } = useQuery(paymentSettingsQuery);
  const [form, setForm] = useState<BankForm | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!form || !user) throw new Error("Sign in to save payment details");
      let uploaded: string | null = null;
      try {
        if (form.payment_method === "qr" && file) uploaded = await uploadPaymentQr(user.id, file);
        const row = { ...bankSettingsInput(form, uploaded), updated_at: new Date().toISOString() };
        const result = settings ? await supabase.from("payment_settings").update(row).eq("id", settings.id).select("id").single() : await supabase.from("payment_settings").insert(row).select("id").single();
        if (result.error) throw result.error;
        // The old QR image is no longer referenced once bank mode or a new upload is saved; best effort, the save already went through.
        const stale = settings?.qr_code_path;
        if (stale && stale !== row.qr_code_path) await supabase.storage.from("payment-qr-codes").remove([stale]);
      } catch (error) {
        if (uploaded) await supabase.storage.from("payment-qr-codes").remove([uploaded]);
        throw error;
      }
    },
    onSuccess: () => { toast.success("Payment details saved"); setForm(null); setFile(null); void qc.invalidateQueries({ queryKey: ["payment-settings"] }); },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  return <>
    <Button variant="outline" size="lg" className="border-white/25 bg-white/5 text-pitch-foreground hover:border-white/50 hover:bg-white/10 hover:text-pitch-foreground" disabled={isLoading || !!error} onClick={() => { setFile(null); setForm({ payment_method: settings?.payment_method === "qr" ? "qr" : "bank", bank_name: settings?.bank_name ?? "", account_name: settings?.account_name ?? "", account_number: settings?.account_number ?? "", instructions: settings?.instructions ?? "", qr_code_path: settings?.qr_code_path ?? null }); }}><Landmark className="mr-2 h-4 w-4" />Payment details</Button>
    <Dialog open={!!form} onOpenChange={(open) => { if (!open && !save.isPending) setForm(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Payment details</DialogTitle><DialogDescription>Pick one: players only see the method on the tab you save.</DialogDescription></DialogHeader>
        {form && <form id="bank-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Tabs value={form.payment_method} onValueChange={(value) => setForm({ ...form, payment_method: value as PaymentMethod })}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="bank" disabled={save.isPending}>Bank details</TabsTrigger><TabsTrigger value="qr" disabled={save.isPending}>QR code</TabsTrigger></TabsList>
            <TabsContent value="bank" className="grid gap-4">
          {([["bank_name", "Bank name"], ["account_name", "Account holder"], ["account_number", "Account number"]] as const).map(([key, label]) => <div key={key} className="grid gap-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} required maxLength={120} disabled={save.isPending} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}
            </TabsContent>
            <TabsContent value="qr" className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="bank-qr" className="flex items-center gap-2"><Upload className="size-4" />Payment QR code (up to 1 MB)</Label><Input id="bank-qr" type="file" accept="image/png,image/jpeg,image/webp" disabled={save.isPending} onChange={(e) => { const next = e.target.files?.[0]; setFile(null); if (!next) return; try { validateReceipt(next); setFile(next); } catch (error) { toast.error((error as Error).message); e.target.value = ""; } }} /></div>
          {file ? <p className="break-words text-sm text-muted-foreground">Selected: {file.name}</p> : form.qr_code_path && <PaymentQr path={form.qr_code_path} />}
          {(file || form.qr_code_path) && <Button variant="ghost" type="button" disabled={save.isPending} onClick={() => { setFile(null); setForm({ ...form, qr_code_path: null }); const input = document.getElementById("bank-qr"); if (input instanceof HTMLInputElement) input.value = ""; }}>Remove QR code</Button>}
            </TabsContent>
          </Tabs>
          <div className="grid gap-1.5"><Label htmlFor="bank-instructions">Payment instructions</Label><Textarea id="bank-instructions" maxLength={2000} disabled={save.isPending} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
        </form>}
        <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={() => setForm(null)}>Close</Button><Button form="bank-form" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}