import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { paymentQrUrl } from "@/lib/payment-qr";

export function PaymentQr({ path, accountNumber }: { path: string; accountNumber?: string | null }) {
  const { data, error, isPending } = useQuery({
    queryKey: ["payment-qr", path],
    queryFn: () => paymentQrUrl(path),
    staleTime: 240_000,
    refetchInterval: 300_000,
  });
  return <div className="my-4">
    <p className="mb-2 text-sm font-semibold">Scan to pay</p>
    {isPending && <p className="text-sm text-muted-foreground">Loading QR code…</p>}
    {error && <p className="text-sm text-destructive">Could not load QR code. Please try again.</p>}
    {data && <a href={data} target="_blank" rel="noreferrer" aria-label="Open payment QR code"><img src={data} alt="Bank payment QR code" className="max-h-72 w-full max-w-72 rounded border object-contain" /></a>}
    {accountNumber?.trim() && <CopyAccountNumber value={accountNumber.trim()} />}
  </div>;
}
// One tap puts the account number on the clipboard, for apps where scanning is awkward.
function CopyAccountNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Account number copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Could not copy. The account number is ${value}`);
    }
  };
  return <Button type="button" variant="outline" className="mt-3 w-full max-w-72 justify-between font-normal" onClick={copy}>
    <span className="truncate tabular">{value}</span>
    <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">{copied ? <><Check className="size-4 text-success" />Copied</> : <><Copy className="size-4" />Copy account number</>}</span>
  </Button>;
}
