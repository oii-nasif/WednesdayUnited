import { useEffect, useState } from "react";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

// A sideways pitch with a goal at the far end. The ball sits as far along as the fund has come,
// so every donation is a step toward goal and a full fund puts the ball in the net.
export function FundPitch({ pct, label, className }: { pct: number; label: string; className?: string }) {
  // Kick off from the centre spot on mount, then glide whenever new donations land.
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPos(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const scored = pct >= 100;
  const clamped = Math.min(100, pos);
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-grass-stripes h-16 ring-1 ring-black/25", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} aria-label={label}>
      <svg viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full text-white/55">
        <g fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          <rect x="4" y="4" width="392" height="56" />
          <line x1="12" y1="4" x2="12" y2="60" />
          <circle cx="12" cy="32" r="14" />
          <rect x="336" y="12" width="60" height="40" />
          <rect x="372" y="22" width="24" height="20" />
        </g>
      </svg>
      {/* Goal mouth and net at the right-hand end. */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-7 border-l-2 border-white/80 bg-white/15 [background-image:repeating-linear-gradient(45deg,rgb(255_255_255/0.35)_0_1px,transparent_1px_6px),repeating-linear-gradient(-45deg,rgb(255_255_255/0.35)_0_1px,transparent_1px_6px)]" />
      {/* The ground the ball has covered. */}
      <div aria-hidden="true" className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent to-accent/40 transition-[width] duration-[1400ms] ease-out" style={{ width: `${clamped}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-[1400ms] ease-out" style={{ left: `calc(${clamped}% - 16px)` }}>
        <Football className={cn("ball-spin size-8 drop-shadow-[0_3px_4px_rgb(0_0_0/0.5)]", scored && "scale-110")} />
      </div>
      {scored && <span className="absolute inset-0 grid place-items-center font-display text-2xl tracking-wider text-white drop-shadow-md">GOAL!</span>}
    </div>
  );
}
