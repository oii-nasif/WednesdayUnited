import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Football } from "@/components/Football";

const SHOWN = 10;

// Guest picker where every participant (you plus guests) pops in as a ball.
export function GuestStepper({ value, onChange, max = 20, label = "Guests" }: { value: number; onChange: (n: number) => void; max?: number; label?: string }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(0, n)));
  return (
    <div role="group" aria-label={label} className="space-y-3">
      <div className="flex items-center gap-3">
        <Button type="button" size="icon" variant="outline" aria-label="Remove a guest" disabled={value <= 0} onClick={() => set(value - 1)}><Minus /></Button>
        <output aria-live="polite" className="min-w-10 text-center font-display text-4xl leading-none">
          <span key={value} className="inline-block animate-in zoom-in-150 duration-200">{value}</span>
        </output>
        <Button type="button" size="icon" variant="outline" aria-label="Add a guest" disabled={value >= max} onClick={() => set(value + 1)}><Plus /></Button>
        <span className="text-sm text-muted-foreground">guest{value === 1 ? "" : "s"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: Math.min(value, SHOWN) + 1 }, (_, i) => (
          <Football key={i} className={`animate-in zoom-in-0 spin-in-180 duration-300 ${i === 0 ? "size-7" : "size-5"}`} />
        ))}
        {value > SHOWN && <span className="text-xs font-semibold text-muted-foreground">+{value - SHOWN}</span>}
        <span className="ml-1 text-xs text-muted-foreground">{value ? `You + ${value}` : "Just you"}</span>
      </div>
    </div>
  );
}
