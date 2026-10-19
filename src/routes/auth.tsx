import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { signInSchema, signInWithEmail } from "@/lib/account";
import { AuthShell, GoogleButton, OrDivider } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Football } from "@/components/Football";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — Wednesday United" },
      { name: "description", content: "Sign in with Google or email to join Wednesday United matches." },
      { property: "og:title", content: "Sign in — Wednesday United" },
      { property: "og:description", content: "Sign in with Google or email to join matches." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => signInWithEmail({ email, password }),
    onError: (e) => toast.error(e.message),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = signInSchema.safeParse({ email, password });
    if (!check.success) { toast.error(check.error.issues[0]?.message ?? "Check your details"); return; }
    signIn.mutate();
  };

  return (
    <AuthShell title="Join the squad" intro="Sign in to grab spots, bring guests and track your payments.">
      <div className="mt-4"><GoogleButton /></div>
      <OrDivider />
      <form className="grid gap-3.5" onSubmit={submit} noValidate>
        <div className="grid gap-1.5"><Label htmlFor="signin-email">Email</Label><Input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="signin-password">Password</Label><Input id="signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" size="lg" variant="accent" disabled={signIn.isPending}>{signIn.isPending ? "Signing in…" : "Sign in with email"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">New here? <Link to="/signup" className="font-semibold text-primary hover:underline">Create an account</Link></p>
      <ul className="auth-benefits mt-4 space-y-2 border-t pt-3 text-xs text-muted-foreground">
        {["See who's playing before you commit", "Bring a friend along as your guest", "Keep track of your games and appearances"].map((t) => (
          <li key={t} className="flex items-center gap-3"><Football className="size-4 shrink-0" />{t}</li>
        ))}
      </ul>
    </AuthShell>
  );
}
