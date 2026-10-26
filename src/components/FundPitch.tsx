import { useEffect, useState } from "react";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

// Progress bar drawn as a pitch: the fill is the ground the fund has covered, the ball rides its leading edge,
// and the goal waits at the far end. Quarter ticks mark the halfway line and the two penalty areas.
export function FundPitch({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Kick off from zero on mount, then advance whenever new donations land.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);
  const scored = clamped >= 100;
  return (
    <div className={cn("relative h-6 w-full", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} aria-label={label}>
      {/* Track: striped turf with the pitch markings. */}
      <div className="absolute inset-0 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/15 [background-image:repeating-linear-gradient(90deg,rgb(255_255_255/0.04)_0_12.5%,transparent_12.5%_25%)]">
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
        <span aria-hidden="true" className="absolute inset-y-1 left-1 w-[14%] rounded-r-sm border border-l-0 border-white/20" />
        <span aria-hidden="true" className="absolute inset-y-1 right-1 w-[14%] rounded-l-sm border border-r-0 border-white/20" />
        {/* Ground covered so far. */}
        <div className="fund-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/70 via-accent to-accent shadow-[0_0_14px_var(--accent)] transition-[width] duration-[1400ms] ease-out" style={{ width: `${shown}%` }} />
      </div>
      {/* Match ball on the leading edge. */}
      <div className="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-[1400ms] ease-out" style={{ left: `clamp(1rem, ${shown}%, calc(100% - 1rem))` }}>
        <Football className={cn("ball-spin size-full drop-shadow-[0_3px_5px_rgb(0_0_0/0.6)]", scored && "scale-110")} />
      </div>
      {/* The goal, with the net lit once the fund is full. */}
      <span aria-hidden="true" className={cn("absolute -right-1 top-1/2 h-9 w-5 -translate-y-1/2 rounded-sm border-2 border-r-0 border-white/70 transition-colors duration-500 [background-image:repeating-linear-gradient(45deg,rgb(255_255_255/0.35)_0_1px,transparent_1px_4px),repeating-linear-gradient(-45deg,rgb(255_255_255/0.35)_0_1px,transparent_1px_4px)]", scored && "border-accent bg-accent/30 shadow-[0_0_12px_var(--accent)]")} />
      {scored && <span className="absolute -top-3 right-5 rounded-sm bg-accent px-1.5 font-display text-xs leading-tight text-accent-foreground shadow">GOAL!</span>}
    </div>
  );
}
