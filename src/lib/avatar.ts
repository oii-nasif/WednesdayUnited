import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signAvatarLinks } from "@/lib/avatar-sign.functions";

export const AVATAR_MAX_BYTES = 300 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const BUCKET = "avatars";
const SIGNED_TTL = 12 * 60 * 60; // seconds

// Mirrors the avatars bucket: JPEG, PNG or WebP, 300 KB at most.
export function validateAvatar(file: File) {
  if (!TYPES[file.type]) throw new Error("Choose a JPG, PNG or WebP image");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Photo must be 300 KB or smaller. Try a smaller or compressed image");
}

// profiles.avatar_url holds either a full URL (from the sign-in provider) or a path inside the private avatars
// bucket, which needs a signed link before a browser can show it.
export const isStoredAvatar = (value: string | null | undefined): value is string => !!value && !/^(https?:|data:|blob:)/.test(value);

// Signing is batched: every path requested in the same tick goes out as one server call. The server signs
// the links because the avatars bucket only allows the file's owner and staff to read it directly.
const pending = new Map<string, ((url: string | null) => void)[]>();
let flush: ReturnType<typeof setTimeout> | null = null;
function signAvatar(path: string) {
  return new Promise<string | null>((resolve) => {
    pending.set(path, [...(pending.get(path) ?? []), resolve]);
    flush ??= setTimeout(async () => {
      flush = null;
      const batch = new Map(pending);
      pending.clear();
      try {
        const { urls } = await signAvatarLinks({ data: { paths: [...batch.keys()] } });
        for (const [p, waiters] of batch) for (const w of waiters) w(urls[p] ?? null);
      } catch {
        for (const waiters of batch.values()) for (const w of waiters) w(null);
      }
    }, 0);
  });
}

// Resolves an avatar value to something an <img> can show. Plain URLs pass straight through; stored paths are
// signed once and cached for most of the link's lifetime.
export function useAvatarUrl(value: string | null | undefined): string | undefined {
  const stored = isStoredAvatar(value);
  const { data } = useQuery({
    queryKey: ["avatar-url", value],
    queryFn: () => signAvatar(value as string),
    enabled: stored,
    staleTime: (SIGNED_TTL - 60 * 60) * 1000,
    gcTime: SIGNED_TTL * 1000,
  });
  return stored ? (data ?? undefined) : (value ?? undefined);
}

const folderOf = async (userId: string) => {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  return (data ?? []).map((f) => `${userId}/${f.name}`);
};

// Uploads under the owner's folder (the only place storage policies allow), points the profile at the path, then
// clears older photos. A timestamped name means a new photo never collides with a cached link to the old one.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  validateAvatar(file);
  const previous = await folderOf(userId);
  const path = `${userId}/${Date.now()}.${TYPES[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message || "Could not upload the photo");
  const { data, error: saveError } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId).select("id");
  if (saveError || !data?.length) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(saveError?.message ?? "Could not save your photo");
  }
  if (previous.length) await supabase.storage.from(BUCKET).remove(previous);
  return path;
}

export async function removeAvatar(userId: string) {
  const { data, error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not remove your photo");
  const previous = await folderOf(userId);
  if (previous.length) await supabase.storage.from(BUCKET).remove(previous);
}
