import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/wu-logo.png.asset.json";

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
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <img src={logo.url} alt="Wednesday United logo" width={112} height={112} className="h-28 w-28 rounded-full object-cover" />
      <h1 className="mt-6 text-5xl">Join the squad</h1>
      <p className="mt-2 text-muted-foreground">Sign in with your Google account to join matches and bring guests.</p>
      <Button size="lg" className="mt-8 w-full" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Continue with Google"}
      </Button>
    </div>
  );
}
