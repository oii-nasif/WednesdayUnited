// Server-only body for avatar link signing. Lives in a .server.ts module so the client bundle never
// imports the request helpers or the privileged Supabase client. See avatar-sign.functions.ts for the
// exported server function and the visibility rules.
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SIGNED_TTL = 12 * 60 * 60; // seconds
const PUBLISHABLE_CACHE: { client: ReturnType<typeof createClient<Database>> } = { client: undefined as never };

// Publishable client for the caller's identity and the anonymous visibility check. New-format sb_ keys are
// opaque, not JWTs: send apikey, never a bearer of the key itself.
function publishableClient() {
  if (!PUBLISHABLE_CACHE.client) {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    const shim = (init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return { ...init, headers };
    };
    PUBLISHABLE_CACHE.client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, shim(init)) },
    });
  }
  return PUBLISHABLE_CACHE.client;
}

// attachSupabaseAuth adds the bearer only when the browser has a session, so signed-in callers carry it and
// anonymous visitors don't. Signed-in squad members may sign any profile photo; anonymous visitors only get
// photos of players on a non-draft match — exactly what public match pages display.
export async function signAvatarLinksImpl(paths: string[]): Promise<Record<string, string | null>> {
  const supabase = publishableClient();
  const bearer = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  let userId: string | null = null;
  if (bearer && bearer !== key) {
    const { data: user } = await supabase.auth.getUser({ headers: { Authorization: `Bearer ${bearer}` } } as never);
    userId = user?.user?.id ?? null;
  }

  const ownerIds = [...new Set(paths.map((p) => p.split("/")[0]))];
  if (userId) {
    const own = ownerIds.indexOf(userId);
    if (own >= 0) ownerIds.splice(own, 1);
  }
  if (ownerIds.length) {
    // Registrations and matches are publicly readable exactly when the match is not a draft, so the same
    // visibility that match pages use keeps this gate honest.
    const { data: visible, error } = await supabase.from("registrations").select("user_id").in("user_id", ownerIds);
    if (error) throw new Error("Could not verify photo visibility");
    const allowed = new Set((visible ?? []).map((r) => r.user_id as string));
    if (paths.some((p) => !allowed.has(p.split("/")[0]))) return {};
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrls(paths, SIGNED_TTL);
  const urls: Record<string, string | null> = {};
  for (const item of signed ?? []) urls[item.path] = item.error ? null : item.signedUrl;
  return urls;
}
