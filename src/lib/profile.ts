import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const POSITIONS = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
  { value: "ALL", label: "All-rounder" },
] as const;
export type Position = (typeof POSITIONS)[number]["value"];
export const isPosition = (v: unknown): v is Position => POSITIONS.some((p) => p.value === v);

export type MyProfile = { id: string; full_name: string | null; email: string | null; avatar_url: string | null; approval_status: string; created_at: string; position: Position | null };

// profiles.position comes from migration 0008. Until the generated types include it, use an untyped view of the same browser client.
const db = supabase as unknown as SupabaseClient;

export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await db.from("profiles").select("id, full_name, email, avatar_url, approval_status, created_at, position").eq("id", userId).single();
      if (error) throw error;
      const row = data as Omit<MyProfile, "position"> & { position: unknown };
      return { ...row, position: isPosition(row.position) ? row.position : null };
    },
  });

export async function updateMyPosition(userId: string, position: Position | null) {
  const { data, error } = await db.from("profiles").update({ position }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not update your profile");
}
