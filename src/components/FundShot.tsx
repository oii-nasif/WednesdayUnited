import { useEffect, useId, useState } from "react";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

// One shot at goal: a boot bottom-left, a net top-right, and the ball frozen part-way along the arc.
// The trail behind it shows how far the fund has come; a full fund puts the ball in the net.
const W = 400, H = 124;
const P0 = { x: 42, y: 96 }, P1 = { x: 190, y: -22 }, P2 = { x: 358, y: 54 };
const bezier = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t ** 2 * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t ** 2 * P2.y,
});
const ARC = `M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

export function FundShot({ pct, label, className }: { pct: number; label: string; className?: string }) {
  const mesh = useId();
  // Leave the boot on mount, then fly further whenever new donations land.
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setT(Math.max(0, Math.min(100, pct)) / 100));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const scored = pct >= 100;
  const ball = bezier(t);
  return (
    <div className={cn("relative aspect-[400/124] w-full", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <pattern id={mesh} width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 3.5h7M3.5 0v7" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        {/* Touchline the shot is taken from. */}
        <line x1="8" y1="106" x2="392" y2="106" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 6" />
        {/* The goal: posts, crossbar and net. */}
        <g className="text-white">
          <rect x="330" y="20" width="62" height="86" fill={`url(#${mesh})`} opacity="0.5" />
          <path d="M330 106V20h62v86" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        </g>
        {/* The boot that struck it. */}
        <path d="M14 96c0-6 4-10 10-10h8l8-7c3-2 6-1 7 2l4 11c1 4-1 7-5 7H20c-4 0-6-1-6-3z" fill="currentColor" opacity="0.9" />
        {/* Flight path: faint ahead, bright behind the ball. */}
        <path d={ARC} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
        <path d={ARC} pathLength={100} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${t * 100} 100`} className="transition-[stroke-dasharray] duration-[1400ms] ease-out" />
      </svg>
      <div className="absolute size-8 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[1400ms] ease-out" style={{ left: `${(ball.x / W) * 100}%`, top: `${(ball.y / H) * 100}%` }}>
        <Football className={cn("ball-spin size-full drop-shadow-[0_4px_6px_rgb(0_0_0/0.5)]", scored && "scale-110")} />
      </div>
      {scored && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-4xl tracking-wider text-accent drop-shadow-md">GOAL!</span>}
    </div>
  );
}
