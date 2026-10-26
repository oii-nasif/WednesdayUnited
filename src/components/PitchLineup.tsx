import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";

type Player = { id: string; user_id: string; guest_count: number; profile: { full_name: string | null; avatar_url: string | null } | null };

// Spreads players across the pitch in columns of up to four, like a loose formation.
function spots(n: number) {
  const cols = Math.max(1, Math.ceil(n / 4));
  const perCol = Math.ceil(n / cols);
  return Array.from({ length: n }, (_, i) => {
    const col = Math.floor(i / perCol);
    const inCol = Math.min(perCol, n - col * perCol);
    return { x: ((col + 1) / (cols + 1)) * 100, y: (((i % perCol) + 1) / (inCol + 1)) * 100 };
  });
}

export function PitchLineup({ players, currentUserId }: { players: Player[]; currentUserId?: string | undefined }) {
  const positions = useMemo(() => spots(players.length), [players.length]);
  const [holder, setHolder] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const passTo = (i: number | null) => {
    setHolder(i);
    setRolling(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setRolling(false), 550);
  };
  const passRandom = () => {
    const options = players.map((_, i) => i).filter((i) => i !== holder);
    passTo(options[Math.floor(Math.random() * options.length)] ?? null);
  };
  const heldAt = holder === null ? undefined : positions[holder];
  const ballAt = heldAt ? { x: heldAt.x + 3, y: heldAt.y + 9 } : { x: 50, y: 50 };
  const holderName = heldAt && holder !== null ? players[holder]?.profile?.full_name ?? "Player" : null;

  return (
    <div>
      <div className="bg-grass-stripes relative aspect-[16/10] overflow-hidden rounded-xl border-4 border-grass shadow-card">
        <div className="pointer-events-none absolute inset-3 rounded-sm border-2 border-white/60" aria-hidden="true">
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-white/60" />
          <div className="absolute left-1/2 top-1/2 aspect-square h-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
          <div className="absolute left-0 top-1/2 h-[46%] w-[14%] -translate-y-1/2 border-2 border-l-0 border-white/60" />
          <div className="absolute right-0 top-1/2 h-[46%] w-[14%] -translate-y-1/2 border-2 border-r-0 border-white/60" />
        </div>
        {players.map((p, i) => {
          const name = p.profile?.full_name ?? "Player";
          const pos = positions[i] ?? { x: 50, y: 50 };
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => passTo(i)}
              aria-label={`Pass the ball to ${name}`}
              className="group absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 animate-in fade-in zoom-in-50 duration-500 fill-mode-both focus-visible:outline-none"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, animationDelay: `${i * 70}ms` }}
            >
              <span className="relative">
                <Avatar className={cn("size-9 border-2 border-white shadow-md transition-transform group-hover:scale-115 group-focus-visible:ring-2 group-focus-visible:ring-accent sm:size-11", p.user_id === currentUserId && "border-accent ring-2 ring-accent/60", heldAt && holder === i && "scale-110")}>
                  <AvatarPhoto src={p.profile?.avatar_url} />
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                {p.guest_count > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground shadow">+{p.guest_count}</span>}
              </span>
              <span className="max-w-full truncate rounded bg-pitch/70 px-1.5 text-[10px] font-semibold text-pitch-foreground sm:text-xs">{name.split(" ")[0]}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={passRandom}
          disabled={!players.length}
          aria-label="Pass the ball to a random player"
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top,scale] duration-500 ease-out enabled:cursor-pointer enabled:hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent"
          style={{ left: `${ballAt.x}%`, top: `${ballAt.y}%` }}
        >
          <Football className={cn("size-5 drop-shadow-md sm:size-6", rolling && "animate-spin [animation-duration:0.45s]")} />
        </button>
        {!players.length && <p className="absolute inset-x-0 bottom-6 text-center font-display text-2xl text-white drop-shadow">No one yet — be the first!</p>}
      </div>
      <p className="mt-2 min-h-4 text-xs text-muted-foreground" aria-live="polite">
        {players.length ? (holderName ? `${holderName} has the ball. Tap anyone to pass.` : "Tap a player, or the ball, to pass it around.") : ""}
      </p>
    </div>
  );
}
