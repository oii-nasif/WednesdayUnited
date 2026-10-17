import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Football } from "@/components/Football";

const COLORS = ["var(--accent)", "var(--primary)", "#fff", "var(--success)", "oklch(0.85 0.17 90)"];

// Full-screen "GOAL!" moment: the ball flies into the net, then confetti bursts. Pointer events pass through.
export function GoalCelebration({ title = "GOAL!", subtitle, onDone }: { title?: string; subtitle?: string; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 2800);
    return () => clearTimeout(t);
  }, []);
  const confetti = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.3;
    const reach = 140 + Math.random() * 220;
    return {
      "--dx": `${Math.cos(angle) * reach}px`,
      "--dy": `${Math.sin(angle) * reach - 60}px`,
      "--r": `${Math.random() * 720 - 360}deg`,
      background: COLORS[i % COLORS.length],
      animationDelay: `${1000 + Math.random() * 150}ms`,
    } as CSSProperties;
  }), []);
  return (
    <div className="goal-overlay pointer-events-none fixed inset-0 z-50 grid place-items-center bg-pitch/55 backdrop-blur-[2px]" role="status" aria-live="assertive">
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 240 130" className="goal-net w-72 text-pitch-foreground sm:w-96" aria-hidden="true">
          <defs>
            <pattern id="goal-mesh" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0H12M0 0V12" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect x="10" y="10" width="220" height="115" fill="url(#goal-mesh)" />
          <path d="M6 128V6H234V128" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
        </svg>
        <Football className="goal-ball absolute left-1/2 top-[30%] -ml-8 -mt-8 size-16" />
        {confetti.map((style, i) => <span key={i} className="confetti absolute left-1/2 top-[30%] h-3 w-2 rounded-[2px]" style={style} />)}
        <p className="goal-text mt-4 font-display text-8xl leading-none text-accent drop-shadow-[0_4px_0_oklch(0.19_0.02_262)] sm:text-9xl">{title}</p>
        {subtitle && <p className="goal-sub mt-2 text-lg font-semibold text-pitch-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
