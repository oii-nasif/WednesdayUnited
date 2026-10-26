import { supabase } from "@/integrations/supabase/client";

export const AVATAR_MAX_BYTES = 300 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Mirrors the avatars bucket: JPEG, PNG or WebP, 300 KB at most.
export function validateAvatar(file: File) {
  if (!TYPES[file.type]) throw new Error("Choose a JPG, PNG or WebP image");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("Photo must be 300 KB or smaller. Try a smaller or compressed image");
}

const folderOf = async (userId: string) => {
  const { data } = await supabase.storage.from("avatars").list(userId);
  return (data ?? []).map((f) => `${userId}/${f.name}`);
};

// Uploads under the owner's folder (the only place storage policies allow), points the profile at it, then clears
// older photos. A timestamped name means the new photo never collides with the cached old URL.
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  validateAvatar(file);
  const previous = await folderOf(userId);
  const path = `${userId}/${Date.now()}.${TYPES[file.type]}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message || "Could not upload the photo");
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { data, error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId).select("id");
  if (saveError || !data?.length) {
    await supabase.storage.from("avatars").remove([path]);
    throw new Error(saveError?.message ?? "Could not save your photo");
  }
  if (previous.length) await supabase.storage.from("avatars").remove(previous);
  return url;
}

export async function removeAvatar(userId: string) {
  const { data, error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not remove your photo");
  const previous = await folderOf(userId);
  if (previous.length) await supabase.storage.from("avatars").remove(previous);
}
