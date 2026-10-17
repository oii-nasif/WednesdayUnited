import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/auth";

export function canManageRole(actorRoles: Role[], targetRoles: Role[]) {
  return actorRoles.includes("super_admin") && !targetRoles.includes("super_admin");
}

export const usersQuery = (actorId: string) => queryOptions({
  queryKey: ["staff-users", actorId],
  queryFn: async () => {
    const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,avatar_url,approval_status,created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (error) throw error;
    if (roleError) throw roleError;
    return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
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