import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { activeDonorCampaignQuery, DONOR_ARTWORK } from "@/lib/donor-campaigns";

const SHOW_MS = 10_000;

/** A live thank-you card from the admin archive, shown once per page load. */
export function DonorPopup() {
  const { data: campaign } = useQuery(activeDonorCampaignQuery);
  const [open, setOpen] = useState(false);
  const artwork = campaign ? DONOR_ARTWORK[campaign.asset_key] : undefined;

  useEffect(() => {
    if (!campaign || !artwork) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [campaign, artwork]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !artwork) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thank you to our top donors"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-4 animate-in fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="relative w-full max-w-[min(90vw,80dvh)]" onClick={(event) => event.stopPropagation()}>
        <img src={artwork.url} alt={artwork.alt} className="w-full rounded-lg shadow-2xl" />
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground shadow-lg hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden rounded-b-lg">
          <div className="h-full bg-accent" style={{ animation: `donor-countdown ${SHOW_MS}ms linear forwards` }} />
        </div>
        <style>{`@keyframes donor-countdown{from{width:100%}to{width:0}}`}</style>
      </div>
    </div>
  );
}
