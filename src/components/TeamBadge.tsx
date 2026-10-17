import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/wu-logo.png.asset.json";

// Club crest with a "WU" monogram fallback for environments where the hosted asset isn't reachable.
export function TeamBadge({ className, alt = "Wednesday United logo" }: { className?: string; alt?: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  // A server-rendered image can fail before hydration, when onError isn't attached yet.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return (
      <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-pitch font-display leading-none text-pitch-foreground ring-2 ring-accent/70", className)}>
        <span className="text-[0.95em]">W<span className="text-accent">U</span></span>
      </span>
    );
  }
  return <img ref={img} src={logo.url} alt={alt} width={80} height={80} onError={() => setFailed(true)} className={cn("shrink-0 rounded-full object-cover", className)} />;
}
