import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

export const signUpSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your name").max(80),
    email,
    password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export type SignUpInput = z.input<typeof signUpSchema>;

export function authErrorMessage(message?: string) {
  const m = message?.toLowerCase() ?? "";
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Sign in instead.";
  if (m.includes("signups not allowed") || m.includes("email provider is disabled") || m.includes("email logins are disabled")) return "Email sign-up isn't switched on yet. Use Google for now.";
  if (m.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  return message || "Something went wrong. Please try again.";
}

// New accounts start as pending players (handle_new_user trigger); staff approve them before they can join matches.
// Returns whether the account still needs its email confirmed before the first sign-in.
export async function createAccount(input: SignUpInput) {
  const v = signUpSchema.parse(input);
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: { data: { full_name: v.full_name }, emailRedirectTo: `${window.location.origin}/auth` },
  });
  if (error) throw new Error(authErrorMessage(error.message));
  // With email confirmation on, an existing address returns a user with no identities instead of an error.
  if (data.user && !data.user.identities?.length) throw new Error(authErrorMessage("already registered"));
  return { needsConfirmation: !data.session };
}

export async function signInWithEmail(input: z.input<typeof signInSchema>) {
  const v = signInSchema.parse(input);
  const { error } = await supabase.auth.signInWithPassword(v);
  if (error) throw new Error(authErrorMessage(error.message));
}
