import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Football } from "@/components/Football";
import { BALL_DESIGNS, setBallDesign, useBallDesign, type BallDesign } from "@/lib/ball-design";
import { cn } from "@/lib/utils";

// Tuned to be forgiving but lively: about a second of hang time per kick, a capped fall speed, and a drift back to centre.
const GRAVITY = 0.45;
const MAX_FALL = 16;
const BOUNCE = 0.6;
const BEST_KEY = "wu-keepy-uppy-best";

// A ball that drops into the hero and can be juggled: each kick before it touches the ground extends the streak.
export function KickAbout({ floorOffset = 0 }: { floorOffset?: number }) {
  const area = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLButtonElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const s = useRef({ x: 0, y: -60, vx: -1.2, vy: 0, rot: 0, w: 0, h: 0, size: 52, raf: 0, last: 0, streak: 0 });
  const [enabled, setEnabled] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const draw = () => {
    const st = s.current;
    const lift = Math.min(1, Math.max(0, (st.h - st.size - st.y) / 260));
    if (ball.current) ball.current.style.transform = `translate3d(${st.x}px, ${st.y}px, 0) rotate(${st.rot}deg)`;
    if (shadow.current) {
      shadow.current.style.transform = `translate3d(${st.x}px, ${st.h - 10}px, 0) scale(${1 - lift * 0.6})`;
      shadow.current.style.opacity = String(0.45 - lift * 0.3);
    }
  };

  const tick = (now: number) => {
    const st = s.current;
    const dt = st.last ? Math.min(2, (now - st.last) / 16.67) : 1;
    st.last = now;
    const floor = st.h - st.size;
    st.vy = Math.min(MAX_FALL, st.vy + GRAVITY * dt);
    if (st.y < floor) st.vx = (st.vx + ((st.w - st.size) / 2 - st.x) * 0.0005 * dt) * 0.996;
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    st.rot += st.vx * dt * 2.4;
    if (st.y >= floor) {
      st.y = floor;
      if (st.vy > 0) st.vy = Math.abs(st.vy) < 1.5 ? 0 : -st.vy * BOUNCE;
      st.vx *= 0.96;
      if (st.streak) { st.streak = 0; setStreak(0); }
    }
    if (st.x < 0 || st.x > st.w - st.size) {
      st.x = Math.min(Math.max(st.x, 0), st.w - st.size);
      st.vx = -st.vx * 0.7;
    }
    draw();
    const resting = st.y >= floor && st.vy === 0 && Math.abs(st.vx) < 0.05;
    st.raf = resting ? 0 : requestAnimationFrame(tick);
  };

  const start = () => {
    const st = s.current;
    if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame(tick); }
  };

  const kick = (offset: number) => {
    const st = s.current;
    st.vx = -offset * 3 + (Math.random() - 0.5) * 0.8;
    st.vy = -(13.2 + Math.random() * 1);
    st.streak += 1;
    setStreak(st.streak);
    setBest((b) => {
      if (st.streak <= b) return b;
      localStorage.setItem(BEST_KEY, String(st.streak));
      return st.streak;
    });
    start();
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    kick(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2))));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kick(Math.random() - 0.5); }
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
    setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!enabled || !el) return;
    const st = s.current;
    const measure = () => {
      st.w = el.clientWidth;
      st.h = el.clientHeight - floorOffset;
      st.size = st.w < 640 ? 52 : 64;
      st.x = Math.min(st.x, st.w - st.size);
      draw();
      start();
    };
    st.x = el.clientWidth * (el.clientWidth < 640 ? 0.72 : 0.52);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(st.raf); st.raf = 0; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, floorOffset]);

  if (!enabled) return null;
  return (
    <div ref={area} className="pointer-events-none absolute inset-0 overflow-hidden">
      <span ref={shadow} className="absolute left-0 top-0 h-3 w-13 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.9),transparent)] will-change-transform sm:w-16" />
      <button
        ref={ball}
        type="button"
        aria-label={`Kick the ball${streak ? `, ${streak} in a row` : ""}`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="pointer-events-auto absolute left-0 top-0 size-13 cursor-pointer touch-none rounded-full will-change-transform before:absolute before:-inset-6 before:rounded-full before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:size-16"
      >
        <Football className="size-full" />
      </button>
      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3 rounded-full bg-pitch/75 py-1 pl-3.5 pr-1 text-xs font-semibold text-pitch-foreground ring-1 ring-white/10 backdrop-blur-sm">
        <span aria-live="polite">
          {streak ? <span key={streak} className="inline-block animate-in zoom-in-150 duration-200">Keepy-uppies: <span className="text-accent">{streak}</span></span> : "Tap the ball to juggle"}
          {best > 0 && <span className="ml-2 text-pitch-foreground/60">Best {best}</span>}
        </span>
        <BallPicker />
      </div>
    </div>
  );
}

// Swatches for the site-wide ball design; the choice is remembered in this browser.
export function BallPicker({ className }: { className?: string }) {
  const chosen = useBallDesign();
  return (
    <div role="radiogroup" aria-label="Ball design" className={cn("flex items-center gap-1 rounded-full bg-white/10 p-1", className)}>
      {(Object.keys(BALL_DESIGNS) as BallDesign[]).map((d) => (
        <button key={d} type="button" role="radio" aria-checked={chosen === d} aria-label={`${BALL_DESIGNS[d].label} ball`} title={BALL_DESIGNS[d].label} onClick={() => setBallDesign(d)}
          className={cn("grid size-7 place-items-center rounded-full transition-all hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent", chosen === d ? "bg-white/20 ring-2 ring-accent" : "opacity-70 hover:opacity-100")}>
          <Football design={d} className="size-5" />
        </button>
      ))}
    </div>
  );
}
