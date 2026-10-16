import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/wu-logo.png.asset.json";
import hero from "@/assets/hero.jpg";
import { ArrowRight } from "lucide-react";

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
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden text-pitch-foreground">
      <img src={hero} alt="Football pitch under floodlights" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-hero-overlay" />
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-6 py-16 text-center page-enter">
      <img src={logo.url} alt="Wednesday United logo" width={112} height={112} className="h-28 w-28 rounded-full object-cover" />
      <h1 className="mt-6 text-5xl">Join the squad</h1>
      <p className="mt-2 text-pitch-foreground/80">Every Wednesday. After office.</p>
      <Button variant="accent" size="lg" className="mt-8 w-full" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Continue with Google"}
        <ArrowRight />
      </Button>
      </div>
    </div>
  );
}
