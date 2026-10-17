import { useRef, type PointerEvent } from "react";
import { Football } from "@/components/Football";
import { PitchLines } from "@/components/PitchLines";
import { TeamBadge } from "@/components/TeamBadge";

type Props = { name: string; avatar?: string | undefined; role: string; rating: number; stats: { label: string; value: number }[] };

// Collectible player card that tilts toward the pointer with a moving glare.
export function PlayerCard({ name, avatar, role, rating, stats }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = card.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * 18}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };
  const reset = () => {
    const el = card.current;
    el?.style.setProperty("--rx", "0deg");
    el?.style.setProperty("--ry", "0deg");
  };
  return (
    <div className="[perspective:900px]" onPointerMove={move} onPointerLeave={reset}>
      <div
        ref={card}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary via-pitch to-pitch-deep p-6 text-pitch-foreground shadow-lift ring-1 ring-white/10 transition-transform duration-200 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d]"
      >
        <PitchLines className="text-white/[0.07]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--gx,30%)_var(--gy,20%),rgb(255_255_255/0.22),transparent_45%)] mix-blend-overlay" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="font-display text-7xl leading-[0.8] text-accent tabular">{rating}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/70">{role}</p>
          </div>
          <TeamBadge alt="" className="size-10 text-base ring-2 ring-white/20" />
        </div>
        <div className="relative mx-auto mt-4 grid size-32 place-items-center rounded-full bg-white/10 ring-4 ring-accent/70 [transform:translateZ(40px)]">
          {avatar ? <img src={avatar} alt="" className="size-full rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="font-display text-6xl">{name.slice(0, 1)}</span>}
          <Football className="absolute -bottom-1 -right-1 size-9 drop-shadow-lg" />
        </div>
        <p className="relative mt-5 truncate text-center font-display text-4xl leading-none">{name}</p>
        <div className="relative mt-5 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-4 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl leading-none tabular">{s.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-pitch-foreground/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
