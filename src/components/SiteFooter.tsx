import { Link } from "@tanstack/react-router";
import { PitchLines } from "@/components/PitchLines";
import { TeamBadge } from "@/components/TeamBadge";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-pitch-deep pb-28 pt-14 text-pitch-foreground lg:pb-12">
      <PitchLines className="text-white/[0.04]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <TeamBadge alt="" className="size-12 text-xl ring-2 ring-white/10" />
            <p className="font-display text-3xl leading-[0.85]">Wednesday<br /><span className="text-accent">United</span></p>
          </div>
          <p className="mt-5 max-w-sm font-display text-4xl leading-none text-pitch-foreground/90 md:text-5xl">Colleagues. Moonlight. <span className="text-accent">One ball.</span></p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm md:justify-self-end">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/45">Play</p>
            <ul className="space-y-2 text-pitch-foreground/75">
              <li><Link to="/" className="hover:text-accent">Upcoming matches</Link></li>
              <li><Link to="/history" className="hover:text-accent">Match history</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/45">Squad</p>
            <ul className="space-y-2 text-pitch-foreground/75">
              <li><Link to="/dashboard" className="hover:text-accent">My games</Link></li>
              <li><Link to="/payments" className="hover:text-accent">Payments</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="relative mx-auto mt-12 flex max-w-6xl flex-wrap justify-between gap-2 border-t border-white/10 px-4 pt-6 text-xs text-pitch-foreground/45">
        <span>Wednesday United · after-office football · <Link to="/privacy" className="hover:text-accent">Privacy</Link> · <Link to="/terms" className="hover:text-accent">Terms</Link></span>
        <span>Every Wednesday, under the moonlight.</span>
      </div>
    </footer>
  );
}
