import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, ShieldCheck } from "lucide-react";
import { createAccount, signUpSchema, type SignUpInput } from "@/lib/account";
import { AuthShell, GoogleButton, OrDivider } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Create account — Wednesday United" },
      { name: "description", content: "Create a Wednesday United account with email or Google." },
      { property: "og:title", content: "Create account — Wednesday United" },
      { property: "og:description", content: "Create an account to join Wednesday United matches." },
    ],
  }),
  component: SignUpPage,
});

type Field = keyof SignUpInput;
const FIELDS: { name: Field; label: string; type: string; autoComplete: string }[] = [
  { name: "full_name", label: "Full name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { name: "confirm", label: "Confirm password", type: "password", autoComplete: "new-password" },
];

function SignUpPage() {
  const [form, setForm] = useState<SignUpInput>({ full_name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const create = useMutation({ mutationFn: () => createAccount(form) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = signUpSchema.safeParse(form);
    if (!check.success) {
      setErrors(Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]).reverse()));
      return;
    }
    setErrors({});
    create.mutate();
  };

  if (create.data?.needsConfirmation) {
    return (
      <AuthShell title="Check your email" intro={`We sent a confirmation link to ${form.email.trim()}.`}>
        <div className="mt-6 space-y-4 rounded-2xl border bg-card p-5 text-sm shadow-card">
          <p className="flex gap-3"><MailCheck className="size-5 shrink-0 text-primary" />Open the link to confirm your address, then sign in.</p>
          <p className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-accent" />A moderator will approve your account before you can join matches.</p>
        </div>
        <Button className="mt-6 w-full" variant="outline" asChild><Link to="/auth">Back to sign in</Link></Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create account" intro="Sign up with Google or email. A moderator approves every new player before their first match.">
      <div className="mt-4"><GoogleButton label="Sign up with Google" /></div>
      <OrDivider />
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
        {FIELDS.map((f) => (
          <div key={f.name} className="grid min-w-0 gap-1.5">
            <Label htmlFor={`signup-${f.name}`}>{f.label}</Label>
            <Input id={`signup-${f.name}`} type={f.type} autoComplete={f.autoComplete} value={form[f.name]} aria-invalid={!!errors[f.name]} aria-describedby={errors[f.name] ? `signup-${f.name}-error` : undefined}
              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
            {errors[f.name] && <p id={`signup-${f.name}-error`} className="text-xs text-destructive">{errors[f.name]}</p>}
          </div>
        ))}
        {create.isError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">{create.error.message}</p>}
        <Button type="submit" size="lg" variant="accent" className="sm:col-span-2" disabled={create.isPending}>{create.isPending ? "Creating account…" : "Create account"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">Already have an account? <Link to="/auth" className="font-semibold text-primary hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
