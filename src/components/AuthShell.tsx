import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/TeamBadge";
import { PitchLines } from "@/components/PitchLines";
import { Moon } from "@/components/Moon";
import { Kicker } from "@/components/PageHeader";
import { KickAbout } from "@/components/KickAbout";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (res.error) {
      toast.error("Sign-in failed. Please try again.");
      setBusy(false);
    }
  };
  return (
    <Button size="lg" className="h-11 w-full justify-between rounded-xl border bg-card px-5 text-foreground shadow-card hover:border-primary/40 hover:bg-card hover:shadow-lift" onClick={signIn} disabled={busy}>
      <span className="flex items-center gap-3"><GoogleMark />{busy ? "Opening Google…" : label}</span>
      <ArrowRight className="text-primary" />
    </Button>
  );
}

export function OrDivider() {
  return <div className="my-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>;
}

// Floodlit hero on the left, form column on the right. Signed-in visitors are sent to their games.
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="grid min-h-[calc(100dvh-65px)] lg:min-h-[calc(100dvh-73px)] lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-moonlight relative hidden overflow-hidden text-pitch-foreground lg:block">
        <img src={hero} alt="" className="absolute inset-0 size-full object-cover opacity-35 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-deep via-pitch/50 to-transparent" />
        <PitchLines className="moonrise text-white/[0.08]" />
        <Moon className="right-8 top-12 size-20 md:size-28" />
        <div className="relative flex h-full flex-col justify-end p-8 pb-16 md:p-14">
          <Kicker className="text-pitch-foreground/75">Every Wednesday · After office</Kicker>
          <p className="mt-4 font-display text-7xl leading-[0.85] md:text-8xl">Moonlight<br />on. <span className="text-accent">Boots on.</span></p>
          <p className="mt-4 max-w-sm text-pitch-foreground/70">Warm up while you're here. Tap the ball to juggle.</p>
        </div>
        <KickAbout />
      </section>
      <section className="flex min-w-0 items-center justify-center px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 lg:px-8 lg:py-5">
        <div className="rise w-full max-w-sm">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <TeamBadge className="size-11 shrink-0 text-2xl shadow-lift ring-2 ring-primary-soft" />
            <h1 className="min-w-0 text-4xl leading-none">{title}</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{intro}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
