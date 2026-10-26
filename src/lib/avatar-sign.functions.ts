// Signs avatar paths for the browser. The avatars bucket is locked to owners and staff at the storage layer,
// so signed links are created here instead: signed-in squad members may sign any profile photo, while
// anonymous visitors only get photos of players who appear on a non-draft match — exactly what public match
// pages display. The privileged client is loaded inside the handler, never at module scope.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MAX_PATHS = 50;
const SIGNED_TTL = 12 * 60 * 60; // seconds
// Avatar paths are "<user id>/<timestamp>.<ext>" inside the avatars bucket. Anything else is rejected
// before any database or storage call happens.
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\w-]+\.\w{3,4}$/;

export const signAvatarLinks = createServerFn({ method: "POST" })
  .inputValidator((input: { paths: string[] }) => {
    const paths = input?.paths;
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS || paths.some((p) => typeof p !== "string" || !PATH_RE.test(p))) {
      throw new Error("Invalid photo path");
    }
    return { paths };
  })
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    // Publishable client for the caller's identity and the anonymous visibility check. New-format sb_ keys
    // are opaque, not JWTs: send apikey, never a bearer of the key itself.
    const shim = (init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return { ...init, headers };
    };
    const supabasePublic = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, shim(init)) },
    });

    // attachSupabaseAuth adds the bearer only when the browser has a session, so signed-in callers carry it
    // and anonymous visitors don't.
    const bearer = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (bearer && bearer !== key) {
      const userClient = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, shim({ ...init, headers: new Headers({ ...(init?.headers ?? {}), Authorization: `Bearer ${bearer}` }) })) },
      });
      const { data: user } = await userClient.auth.getUser();
      userId = user?.user?.id ?? null;
    }

    const ownerIds = [...new Set(data.paths.map((p) => p.split("/")[0]))];
    if (userId) {
      ownerIds.splice(ownerIds.indexOf(userId), 1);
    }
    if (ownerIds.length) {
      // Anonymous (or other-user) requests: only photos of players on a non-draft match may be signed.
      // Registrations and matches are publicly readable exactly on that condition, so the same RLS that
      // hides drafts here keeps the gate honest.
      const { data: visible, error } = await supabasePublic
        .from("registrations")
        .select("user_id")
        .in("user_id", ownerIds)
        .limit(MAX_PATHS);
      if (error) throw new Error("Could not verify photo visibility");
      const allowed = new Set((visible ?? []).map((r) => r.user_id));
      if (data.paths.some((p) => !allowed.has(p.split("/")[0]))) {
        return { urls: {} };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrls(data.paths, SIGNED_TTL);
    const urls: Record<string, string | null> = {};
    for (const item of signed ?? []) urls[item.path] = item.error ? null : item.signedUrl;
    return { urls };
  });

function getRequestHeader(name: string): string | undefined {
  return getRequestHeadersInstance().get(name);
}

function getRequestHeadersInstance(): Headers {
  // resolved lazily so the client bundle never imports the server-only module
  throw new Error("server only");
}
