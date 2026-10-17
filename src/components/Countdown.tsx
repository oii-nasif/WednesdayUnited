import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

// Ticks once a second after mount (never on the server, so SSR markup stays stable).
export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target || now === null) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  return { done: ms === 0, d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60, s: Math.floor(ms / 1000) % 60 };
}

// Stadium scoreboard: four flip-style cells counting down to kick-off.
export function Countdown({ target, className, tone = "dark" }: { target: string; className?: string; tone?: "dark" | "light" }) {
  const left = useCountdown(target);
  const cells: [string, string][] = left ? [[String(left.d), "Days"], [pad(left.h), "Hrs"], [pad(left.m), "Min"], [pad(left.s), "Sec"]] : [["–", "Days"], ["––", "Hrs"], ["––", "Min"], ["––", "Sec"]];
  if (left?.done) return <p className={cn("font-display text-3xl text-accent", className)}>Kick-off!</p>;
  return (
    <div className={cn("flex gap-2", className)} role="timer" aria-label={left ? `${left.d} days ${left.h} hours ${left.m} minutes until kick-off` : "Countdown to kick-off"}>
      {cells.map(([v, l]) => (
        <div key={l} className={cn("flex min-w-14 flex-col items-center rounded-lg px-2 py-2 sm:min-w-16", tone === "dark" ? "bg-pitch-deep/80 ring-1 ring-white/10" : "bg-primary-soft")}>
          <span className="overflow-hidden font-display text-4xl leading-none tabular sm:text-5xl">
            <span key={v} className={cn("tick inline-block", tone === "dark" ? "text-pitch-foreground" : "text-primary")}>{v}</span>
          </span>
          <span className={cn("mt-1 text-[10px] font-bold uppercase tracking-widest", tone === "dark" ? "text-pitch-foreground/55" : "text-muted-foreground")}>{l}</span>
        </div>
      ))}
    </div>
  );
}
