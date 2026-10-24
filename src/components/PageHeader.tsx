import type { ReactNode } from "react";
import { PitchLines } from "@/components/PitchLines";
import { cn } from "@/lib/utils";

// Navy floodlit band that opens every inner page: kicker, display title, optional copy and actions.
export function PageHeader({ kicker, title, children, actions, className, compact = false }: { kicker: string; title: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <section className={cn("bg-moonlight relative overflow-hidden text-pitch-foreground", className)}>
      <PitchLines className="text-white/[0.06]" />
      <div className={cn("relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4", compact ? "pb-8 pt-8 md:pb-10 md:pt-10" : "pb-10 pt-12 md:pb-14 md:pt-16")}>
        <div className="rise max-w-2xl">
          <Kicker className="text-pitch-foreground/70">{kicker}</Kicker>
          <h1 className={cn("mt-3 leading-[0.9]", compact ? "text-5xl md:text-6xl" : "text-6xl md:text-7xl")}>{title}</h1>
          {children && <div className={cn("text-pitch-foreground/75", compact ? "mt-2 text-sm" : "mt-4")}>{children}</div>}
        </div>
        {actions && <div className="rise flex flex-wrap gap-2 [animation-delay:120ms]">{actions}</div>}
      </div>
      <div className="h-1 bg-gradient-to-r from-accent via-accent to-primary" />
    </section>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em]", className)}>
      <span className="h-0.5 w-6 rounded-full bg-accent" />
      {children}
    </p>
  );
}

// Numbered section title ("01 — Fixtures") with an optional trailing action.
export function SectionHeading({ index, kicker, title, action }: { index?: string; kicker: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-end gap-4">
        {index && <span className="font-display text-6xl leading-[0.8] text-primary/15">{index}</span>}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{kicker}</p>
          <h2 className="mt-1 text-4xl leading-none md:text-5xl">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

// Big scoreboard number with a label, for stat strips.
export function Stat({ label, value, icon, tone = "primary" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: "primary" | "accent" | "success" | "light" }) {
  const color = { primary: "text-primary", accent: "text-accent", success: "text-success", light: "text-pitch-foreground" }[tone];
  return (
    <div className="flex min-w-0 items-center gap-4">
      {icon && <span className={cn("hidden size-11 shrink-0 sm:grid place-items-center rounded-xl bg-primary-soft [&_svg]:size-5", color)}>{icon}</span>}
      <div className="min-w-0">
        <p className={cn("truncate font-display text-3xl leading-none tabular sm:text-4xl md:text-5xl", color)}>{value}</p>
        <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{label}</p>
      </div>
    </div>
  );
}
