import { useQuery } from "@tanstack/react-query";
import { paymentQrUrl } from "@/lib/payment-qr";

export function PaymentQr({ path }: { path: string }) {
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
  </div>;
}