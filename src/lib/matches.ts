import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MATCH_SELECT =
  "*, location:locations(*), registrations(id, user_id, guest_count, added_by_staff)";

type RawMatch = NonNullable<Awaited<ReturnType<typeof fetchRawMatch>>>;
async function withPublicPlayers(matches: RawMatch[]) {
  const ids = [...new Set(matches.flatMap((m) => m.registrations.map((r) => r.user_id)))];
  const { data, error } = ids.length
    ? await supabase.from("player_directory").select("id, full_name, avatar_url").in("id", ids)
    : { data: [], error: null };
  if (error) throw error;
  const profiles = new Map((data ?? []).map((p) => [p.id, p]));
  return matches.map((m) => ({ ...m, registrations: m.registrations.map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null })) }));
}

export type MatchRow = Awaited<ReturnType<typeof fetchMatch>>;

async function fetchRawMatch(id: string) {
  const { data, error } = await supabase.from("matches").select(MATCH_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchMatch(id: string) {
  const match = await fetchRawMatch(id);
  return match ? (await withPublicPlayers([match]))[0] ?? null : null;
}

export const matchQuery = (id: string) =>
  queryOptions({ queryKey: ["match", id], queryFn: () => fetchMatch(id) });

export const matchesQuery = (kind: "upcoming" | "history" | "all") =>
  queryOptions({
    queryKey: ["matches", kind],
    queryFn: async () => {
      let q = supabase.from("matches").select(MATCH_SELECT);
      if (kind === "upcoming") q = q.eq("status", "published").order("starts_at", { ascending: true });
      else if (kind === "history")
        q = q.in("status", ["completed", "cancelled"]).order("starts_at", { ascending: false });
      else q = q.order("starts_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return withPublicPlayers(data ?? []);
    },
  });

export const locationsQuery = queryOptions({
  queryKey: ["locations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("locations").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export function participantCount(regs: { guest_count: number }[] | null | undefined) {
  return (regs ?? []).reduce((n, r) => n + 1 + r.guest_count, 0);
}

// Matches the column default; the database enforces each match's max_guests.
export const DEFAULT_MAX_GUESTS = 5;

export function guestCount(regs: { guest_count: number }[] | null | undefined) {
  return (regs ?? []).reduce((n, r) => n + r.guest_count, 0);
}

const TZ = "Asia/Dhaka";
export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ });
export const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

export function registrationOpen(m: { status: string; registration_deadline: string | null }) {
  return m.status === "published" && (!m.registration_deadline || new Date(m.registration_deadline) > new Date());
}

export async function joinMatch(matchId: string, userId: string, guests = 0) {
  const { error } = await supabase.from("registrations").insert({ match_id: matchId, user_id: userId, guest_count: guests });
  if (error) throw error.message.includes("duplicate") ? new Error("You're already registered.") : error;
}

// What the match card offers the viewer: a one-tap join, a "you're in" marker, or nothing.
export function quickJoinState(
  m: { status: string; registration_deadline: string | null; player_limit: number | null; registrations: { user_id: string; guest_count: number }[] },
  viewer: { userId: string | undefined; canJoin: boolean; isStaff: boolean },
): "join" | "joined" | null {
  if (!viewer.userId || m.status !== "published") return null;
  if (m.registrations.some((r) => r.user_id === viewer.userId)) return "joined";
  if (!viewer.canJoin || !registrationOpen(m)) return null;
  // The DB player-limit trigger lets staff overfill a match.
  if (!viewer.isStaff && m.player_limit && participantCount(m.registrations) + 1 > m.player_limit) return null;
  return "join";
}

export function spotsLabel(total: number, limit: number | null) {
  if (!limit) return null;
  const left = limit - total;
  return left <= 0 ? "Full" : `${left} spot${left === 1 ? "" : "s"} left`;
}
