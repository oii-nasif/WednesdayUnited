import { useId } from "react";
import { cn } from "@/lib/utils";

// Decorative moon: grey maria and craters on a pale disc, a soft shadowed limb on one side and a faint halo.
export function Moon({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="-60 -60 120 120" aria-hidden="true" className={cn("moonrise pointer-events-none absolute", className)}>
      <defs>
        <radialGradient id={`${id}halo`}>
          <stop offset="55%" stopColor="#dfe5f5" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#dfe5f5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}disc`} cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#f4f5f8" />
          <stop offset="70%" stopColor="#d9dce5" />
          <stop offset="100%" stopColor="#b9bdcb" />
        </radialGradient>
        {/* Night side: darkens the lower-right limb so the moon reads as a lit sphere, not a lamp. */}
        <radialGradient id={`${id}shade`} cx="22%" cy="20%" r="95%">
          <stop offset="58%" stopColor="#0b1430" stopOpacity="0" />
          <stop offset="100%" stopColor="#0b1430" stopOpacity="0.72" />
        </radialGradient>
        <clipPath id={`${id}clip`}><circle r="40" /></clipPath>
      </defs>
      <circle r="60" fill={`url(#${id}halo)`} />
      <circle r="40" fill={`url(#${id}disc)`} />
      <g clipPath={`url(#${id}clip)`}>
        <g fill="#8e94a8" opacity="0.38">
          <path d="M-22 -18c6-8 18-9 24-3 5 5 2 12-5 14-7 3-9 9-16 8-8-1-9-12-3-19z" />
          <path d="M6 -8c6-4 15-2 17 5 2 6-4 9-9 8-5 0-6 5-11 4-5-2-3-13 3-17z" />
          <path d="M-10 10c5-3 12-1 13 4s-3 8-8 8-11-7-5-12z" />
          <path d="M14 14c4-2 9 0 9 4s-4 6-7 5-6-6-2-9z" />
        </g>
        <g fill="#a3a9ba" stroke="#f5f6fa" strokeOpacity="0.55" strokeWidth="0.8">
          <circle cx="-4" cy="24" r="4.5" />
          <circle cx="20" cy="-20" r="3.2" />
          <circle cx="-27" cy="6" r="2.6" />
          <circle cx="9" cy="28" r="2.2" />
          <circle cx="27" cy="2" r="1.8" />
        </g>
        <circle r="40" fill={`url(#${id}shade)`} />
      </g>
    </svg>
  );
}
