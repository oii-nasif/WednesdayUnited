import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/auth";
import { placeholderSchema, type PlaceholderInput } from "@/lib/placeholder-rules";

// Placeholder columns and RPCs come from migration 0022. Until the generated Supabase types include them, this file
// reads profiles through an untyped view of the browser client. RLS and the SQL functions enforce every rule.
const db = supabase as unknown as SupabaseClient;

export type StaffUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  approval_status: string;
  placeholder: boolean;
  created_at: string;
  roles: Role[];
};

export function canManageRole(actorRoles: Role[], targetRoles: Role[]) {
  return actorRoles.includes("super_admin") && !targetRoles.includes("super_admin");
}

export const usersQuery = (actorId: string) => queryOptions({
  queryKey: ["staff-users", actorId],
  queryFn: async (): Promise<StaffUser[]> => {
    const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
      db.from("profiles").select("id,full_name,email,phone,avatar_url,approval_status,placeholder,created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (error) throw error;
    if (roleError) throw roleError;
    return ((profiles ?? []) as Omit<StaffUser, "roles">[]).map((p) => ({ ...p, placeholder: !!p.placeholder, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
  },
  refetchInterval: 30000,
});

export async function decideApproval(playerId: string, decision: "approved" | "rejected") {
  const { error } = await supabase.rpc("decide_player_approval", { player_id: playerId, decision });
  if (error) throw error;
}

export async function setPlayerRole(playerId: string, role: "player" | "moderator") {
  const { error } = await supabase.rpc("set_player_role", { player_id: playerId, new_role: role });
  if (error) throw error;
}

// Members added by staff before they sign up. Every call is staff-checked in SQL.
export async function createPlaceholderPlayer(input: PlaceholderInput): Promise<string> {
  const v = placeholderSchema.parse(input);
  const { data, error } = await db.rpc("create_placeholder_player", { _full_name: v.full_name, _phone: v.phone || null });
  if (error) throw error;
  return data as string;
}

export async function updatePlaceholderPlayer(playerId: string, input: PlaceholderInput) {
  const v = placeholderSchema.parse(input);
  const { error } = await db.rpc("update_placeholder_player", { _player_id: playerId, _full_name: v.full_name, _phone: v.phone || null });
  if (error) throw error;
}

export async function deletePlaceholderPlayer(playerId: string) {
  const { error } = await db.rpc("delete_placeholder_player", { _player_id: playerId });
  if (error) throw error;
}

// Moves the placeholder's games, balance and payments onto the signed-up account, then removes the placeholder.
export async function mergePlaceholderPlayer(placeholderId: string, targetId: string) {
  const { error } = await db.rpc("merge_placeholder_player", { _placeholder_id: placeholderId, _target_id: targetId });
  if (error) throw error;
}
