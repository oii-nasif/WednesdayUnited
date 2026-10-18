import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/auth";

export const POSITIONS = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
  { value: "ALL", label: "All-rounder" },
] as const;
export type Position = (typeof POSITIONS)[number]["value"];
export const isPosition = (v: unknown): v is Position => POSITIONS.some((p) => p.value === v);
export const positionLabel = (v: string | null) => POSITIONS.find((p) => p.value === v)?.label ?? null;

export const roleLabel = (roles: Role[]) => (roles.includes("super_admin") ? "Super admin" : roles.includes("moderator") ? "Moderator" : "Player");

const PROFILE_SELECT = "id, full_name, email, avatar_url, approval_status, created_at, position";

export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", userId).single();
      if (error) throw error;
      return { ...data, position: isPosition(data.position) ? data.position : null };
    },
  });

// Staff-only by RLS: profiles and other players' roles are readable by their owner and staff.
export const playerProfileQuery = (playerId: string) =>
  queryOptions({
    queryKey: ["player-profile", playerId],
    queryFn: async () => {
      const [profile, roles, regs] = await Promise.all([
        supabase.from("profiles").select(PROFILE_SELECT).eq("id", playerId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", playerId),
        supabase.from("registrations").select("id, guest_count, match:matches(id, title, starts_at, status)").eq("user_id", playerId),
      ]);
      if (profile.error) throw profile.error;
      if (roles.error) throw roles.error;
      if (regs.error) throw regs.error;
      if (!profile.data) return null;
      return {
        ...profile.data,
        position: isPosition(profile.data.position) ? profile.data.position : null,
        roles: (roles.data ?? []).map((r) => r.role as Role),
        registrations: (regs.data ?? []).sort((a, b) => (b.match?.starts_at ?? "").localeCompare(a.match?.starts_at ?? "")),
      };
    },
  });

export async function updateMyPosition(userId: string, position: Position | null) {
  const { data, error } = await supabase.from("profiles").update({ position }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not update your profile");
}
