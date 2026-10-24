import { useEffect, useState } from "react";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

const SLOTS = 10;

// Ten balls in a row, lit from the left as the fund fills; the last one sits in the net.
// Reads at any height, which a progress bar does not.
export function GoalTally({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Never show empty while money is in, never show full until it actually is.
  const target = clamped >= 100 ? SLOTS : clamped > 0 ? Math.max(1, Math.min(SLOTS - 1, Math.round(clamped / 10))) : 0;
  // Light up one at a time on mount, then whenever new donations land.
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (lit === target) return;
    const t = setTimeout(() => setLit((n) => n + Math.sign(target - n)), lit === 0 ? 250 : 110);
    return () => clearTimeout(t);
  }, [lit, target]);
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-2", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={label}>
      {Array.from({ length: SLOTS }, (_, i) => {
        const on = i < lit;
        const last = i === SLOTS - 1;
        return (
          <span key={i} className={cn("relative grid size-6 shrink-0 place-items-center rounded-full transition-all duration-300 sm:size-7", last && "ml-1 rounded-md bg-white/10 ring-1 ring-white/40 [background-image:repeating-linear-gradient(45deg,rgb(255_255_255/0.3)_0_1px,transparent_1px_5px),repeating-linear-gradient(-45deg,rgb(255_255_255/0.3)_0_1px,transparent_1px_5px)]")}>
            <Football className={cn("size-full transition-all duration-300", on ? "scale-100 opacity-100 drop-shadow-[0_0_6px_var(--accent)]" : "scale-75 opacity-25 grayscale")} />
            {on && last && <span className="absolute -top-1.5 -right-1.5 rounded-sm bg-accent px-1 font-display text-[9px] leading-tight text-accent-foreground">GOAL</span>}
          </span>
        );
      })}
    </div>
  );
}
