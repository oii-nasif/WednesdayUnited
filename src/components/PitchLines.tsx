import { cn } from "@/lib/utils";

// Decorative top-down pitch markings, drawn in currentColor so callers set tone with text-* and opacity.
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1050 680" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", className)}>
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="25" y="25" width="1000" height="630" />
        <line x1="525" y1="25" x2="525" y2="655" />
        <circle cx="525" cy="340" r="92" />
        <circle cx="525" cy="340" r="4" fill="currentColor" />
        <rect x="25" y="138" width="165" height="404" />
        <rect x="25" y="248" width="55" height="184" />
        <path d="M190 268a92 92 0 0 1 0 144" />
        <rect x="860" y="138" width="165" height="404" />
        <rect x="970" y="248" width="55" height="184" />
        <path d="M860 268a92 92 0 0 0 0 144" />
        <circle cx="135" cy="340" r="4" fill="currentColor" />
        <circle cx="915" cy="340" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}
