import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/TeamBadge";
import hero from "@/assets/hero.jpg";
import { ArrowRight } from "lucide-react";
import { PitchLines } from "@/components/PitchLines";
import { Kicker } from "@/components/PageHeader";
import { KickAbout } from "@/components/KickAbout";
import { Football } from "@/components/Football";

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

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — Wednesday United" },
      { name: "description", content: "Sign in with Google to join Wednesday United matches." },
      { property: "og:title", content: "Sign in — Wednesday United" },
      { property: "og:description", content: "Sign in with Google to join matches." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const signIn = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (res.error) {
      toast.error("Sign-in failed. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-moonlight relative min-h-[46vh] overflow-hidden text-pitch-foreground">
        <img src={hero} alt="" className="absolute inset-0 size-full object-cover opacity-35 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-pitch-deep via-pitch/50 to-transparent" />
        <PitchLines className="moonrise text-white/[0.08]" />
        <span aria-hidden="true" className="moonrise pointer-events-none absolute right-10 top-16 size-14 md:size-20 rounded-full bg-[radial-gradient(circle_at_38%_36%,#f7f8fc,#d9deeb_55%,#aab3cb)] opacity-90 shadow-[0_0_60px_18px_oklch(0.92_0.03_250/0.28),0_0_160px_60px_oklch(0.8_0.06_255/0.18)]" />
        <div className="relative flex h-full flex-col justify-end p-8 pb-16 md:p-14">
          <Kicker className="text-pitch-foreground/75">Every Wednesday · After office</Kicker>
          <p className="mt-4 font-display text-7xl leading-[0.85] md:text-8xl">Moonlight<br />on. <span className="text-accent">Boots on.</span></p>
          <p className="mt-4 max-w-sm text-pitch-foreground/70">Warm up while you're here. Tap the ball to juggle.</p>
        </div>
        <KickAbout />
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="rise w-full max-w-sm">
          <TeamBadge className="size-20 text-3xl shadow-lift ring-4 ring-primary-soft" />
          <h1 className="mt-6 text-6xl leading-none">Join the squad</h1>
          <p className="mt-2 text-muted-foreground">Sign in to grab spots, bring guests and track your payments.</p>
          <Button size="lg" className="mt-8 h-14 w-full justify-between rounded-xl border bg-card px-5 text-foreground shadow-card hover:border-primary/40 hover:bg-card hover:shadow-lift" onClick={signIn} disabled={busy}>
            <span className="flex items-center gap-3"><GoogleMark />{busy ? "Opening Google…" : "Continue with Google"}</span>
            <ArrowRight className="text-primary" />
          </Button>
          <ul className="mt-10 space-y-3 border-t pt-6 text-sm text-muted-foreground">
            {["See who's playing before you commit", "Bring a friend along as your guest", "Keep track of your games and appearances"].map((t) => (
              <li key={t} className="flex items-center gap-3"><Football className="size-4 shrink-0" />{t}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
