import { useSyncExternalStore } from "react";

export type BallDesign = "molten" | "classic" | "tango" | "rihla";

// Molten F5C3555 (size 5) is the ball the squad actually plays with and the site default. The alternatives
// stay selectable: Classic is the 1970 black-and-white panel ball, Tango (1978–2002) is known for its 12
// rings, Rihla (2022) for its curved triangular panels with speed stripes. All three use the team's blue
// and orange.
export const BALL_DESIGNS: Record<BallDesign, { label: string }> = {
  molten: { label: "Molten" },
  classic: { label: "Classic" },
  tango: { label: "Tango" },
  rihla: { label: "Rihla" },
};

const DEFAULT: BallDesign = "molten";
const KEY = "wu-ball-design";
const listeners = new Set<() => void>();
const isDesign = (v: unknown): v is BallDesign => v === "molten" || v === "classic" || v === "tango" || v === "rihla";
let current: BallDesign | null = null;

export function getBallDesign(): BallDesign {
  if (current === null) {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    current = isDesign(saved) ? saved : DEFAULT;
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = isDesign(e.newValue) ? e.newValue : DEFAULT;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function setBallDesign(design: BallDesign) {
  current = design;
  localStorage.setItem(KEY, design);
  listeners.forEach((l) => l());
}

// The chosen ball applies site-wide and is remembered per browser; the server always renders the default.
export function useBallDesign() {
  return useSyncExternalStore(subscribe, getBallDesign, () => DEFAULT);
}
