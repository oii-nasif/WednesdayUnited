import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalDecision = Exclude<ApprovalStatus, "pending">;

// profiles.approval_status and decide_player_approval come from the squad-approval migration. Until the generated
// types include them, these queries use an untyped client view of the same browser client.
const db = supabase as unknown as SupabaseClient;

// Postgres "undefined column" / PostgREST "function not found": the migration hasn't been applied yet.
const notMigrated = (code?: string) => code === "42703" || code === "PGRST202" || code === "42883";
const isStatus = (v: unknown): v is ApprovalStatus => v === "pending" || v === "approved" || v === "rejected";

// Before the migration exists everyone keeps today's behaviour (approved); RLS remains the real gate either way.
export async function fetchApprovalStatus(userId: string): Promise<ApprovalStatus> {
  const { data, error } = await db.from("profiles").select("approval_status").eq("id", userId).maybeSingle();
  if (error || !data) return "approved";
  const status = (data as { approval_status?: unknown }).approval_status;
  return isStatus(status) ? status : "approved";
}

export type SquadPlayer = { id: string; full_name: string | null; email: string | null; avatar_url: string | null; created_at: string; approval_status: ApprovalStatus; approved_at: string | null };

export const squadPlayersQuery = queryOptions({
  queryKey: ["squad-players"],
  queryFn: async (): Promise<{ available: boolean; players: SquadPlayer[] }> => {
    const { data, error } = await db.from("profiles").select("id, full_name, email, avatar_url, created_at, approval_status, approved_at").order("created_at", { ascending: false });
    if (error) {
      if (notMigrated(error.code)) return { available: false, players: [] };
      throw error;
    }
    return { available: true, players: (data ?? []) as SquadPlayer[] };
  },
});

export function usePendingPlayerCount() {
  const { data } = useQuery(squadPlayersQuery);
  return data?.players.filter((p) => p.approval_status === "pending").length ?? 0;
}

export async function decidePlayerApproval(playerId: string, decision: ApprovalDecision) {
  const { error } = await db.rpc("decide_player_approval", { player_id: playerId, decision });
  if (error) throw new Error(notMigrated(error.code) ? "Player approvals aren't switched on yet. The database update is still pending." : error.message);
}

// Row-level security rejects a pending player's join; translate that into something a person can act on.
export function joinErrorMessage(code?: string, message?: string) {
  if (code === "42501" || message?.includes("row-level security")) return "Your squad request is waiting for a moderator's approval.";
  if (message?.includes("duplicate")) return "You're already registered.";
  return message ?? "Could not join this match.";
}
