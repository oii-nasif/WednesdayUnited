import { useEffect, useState } from "react";
import { X } from "lucide-react";
import donorImage from "@/assets/donor_appreciation.png.asset.json";

const SHOW_MS = 10_000;

/** Thank-you card for top donors, shown once per page load, auto-closes after 10s. */
export function DonorPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
    const t = window.setTimeout(() => setOpen(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thank you to our top donors"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-4 animate-in fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="relative w-full max-w-[min(90vw,80dvh)]" onClick={(e) => e.stopPropagation()}>
        <img
          src={donorImage.url}
          alt="Thank you, our top donors: Md. Rakibul Alam Tanvi, Md. Jahangir Alam and Md. Kausar"
          className="w-full rounded-lg shadow-2xl"
        />
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
