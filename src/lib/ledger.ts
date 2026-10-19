import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { paymentSchema, validateReceipt } from "@/lib/payment-rules";
import { donationGoalInput } from "@/lib/donation-rules";

// Ledger tables, views and RPCs come from migration 0010. Until the generated Supabase types include them, this file
// is the only place that uses an untyped view of the browser client. RLS and the SQL functions enforce every rule.
const db = supabase as unknown as SupabaseClient;

export type LedgerKind = "payment" | "match_charge" | "charge_reversal" | "adjustment";
export type LedgerEntry = {
  id: string; user_id: string; kind: LedgerKind; amount: number; match_id: string | null; payment_id: string | null;
  note: string | null; created_by: string | null; created_at: string;
  profile?: { full_name: string | null } | null; match?: { title: string; starts_at: string } | null;
};
export type PlayerBalance = { user_id: string; full_name: string | null; avatar_url: string | null; balance: number; last_activity: string | null };
export type MatchDue = { user_id: string; charged: number; covered: number; due: number };
export type DonationGoal = { id: string; title: string; target_amount: number; collected_amount: number; active: boolean };
export type PaymentPurpose = "match" | "advance" | "donation";

export const ledgerKindLabel: Record<LedgerKind, string> = { payment: "Payment", match_charge: "Match cost", charge_reversal: "Cost reversed", adjustment: "Adjustment" };

const num = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]) => ({ ...row, ...Object.fromEntries(keys.map((k) => [k, Number(row[k] ?? 0)])) }) as T;

export const ledgerQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["ledger", userId ?? "team"],
    queryFn: async (): Promise<LedgerEntry[]> => {
      let q = db.from("ledger_entries").select("*, profile:profiles!ledger_entries_user_id_fkey(full_name), match:matches(title, starts_at)").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as LedgerEntry[]).map((e) => num(e, ["amount"]));
    },
  });

export const balanceQuery = (userId: string) =>
  queryOptions({
    queryKey: ["balances", userId],
    queryFn: async () => {
      const { data, error } = await db.from("player_balances").select("balance").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return Number((data as { balance?: number } | null)?.balance ?? 0);
    },
  });

// Staff only by RLS: everyone's balance, biggest dues first.
export const balancesQuery = queryOptions({
  queryKey: ["balances", "team"],
  queryFn: async (): Promise<PlayerBalance[]> => {
    const { data, error } = await db.from("player_balances").select("*").order("balance", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as PlayerBalance[]).map((b) => num(b, ["balance"]));
  },
});

export const matchDuesQuery = (matchId: string) =>
  queryOptions({
    queryKey: ["match-dues", matchId],
    queryFn: async () => {
      const { data, error } = await db.rpc("match_dues", { _match_id: matchId });
      if (error) throw error;
      return new Map(((data ?? []) as MatchDue[]).map((d) => [d.user_id, num(d, ["charged", "covered", "due"])]));
    },
  });

export type PlayerMatchDue = MatchDue & { match_id: string; title: string; starts_at: string };
export type UpcomingPayable = { match_id: string; title: string; starts_at: string; prepayment: number };

// Matches a player can pay for: played ones with something still due, and booked ones they've signed up for.
export const payableMatchesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["match-dues", "player", userId],
    queryFn: async () => {
      const [dues, upcoming] = await Promise.all([
        db.rpc("player_match_dues", { _user_id: userId }),
        db.from("registrations").select("guest_count, match:matches!inner(id, title, starts_at, status, prepayment_required, prepayment_amount)").eq("user_id", userId).eq("match.status", "published"),
      ]);
      if (dues.error) throw dues.error;
      if (upcoming.error) throw upcoming.error;
      type Row = { guest_count: number; match: { id: string; title: string; starts_at: string; prepayment_required: boolean; prepayment_amount: number | null } };
      return {
        due: ((dues.data ?? []) as PlayerMatchDue[]).map((d) => num(d, ["charged", "covered", "due"])).filter((d) => d.due > 0),
        upcoming: ((upcoming.data ?? []) as unknown as Row[]).map((r): UpcomingPayable => ({ match_id: r.match.id, title: r.match.title, starts_at: r.match.starts_at, prepayment: r.match.prepayment_required ? Number(r.match.prepayment_amount ?? 0) * (1 + r.guest_count) : 0 })),
      };
    },
  });

export const donationGoalsQuery = queryOptions({
  queryKey: ["donation-goal"],
  queryFn: async () => {
    const { data, error } = await supabase.from("donation_goals").select("*").eq("active", true).order("created_at", { ascending: false }).order("id");
    if (error) throw error;
    return (data ?? []).map((goal) => num(goal as DonationGoal, ["target_amount", "collected_amount"]));
  },
});

// Refresh everything that can move when money moves.
export function invalidateMoney(qc: QueryClient) {
  for (const key of ["payments", "ledger", "balances", "match-dues", "donation-goal", "matches", "match", "notifications"]) void qc.invalidateQueries({ queryKey: [key] });
}

export async function submitPayment(input: { userId: string; purpose: PaymentPurpose; matchId?: string | undefined; goalId?: string | undefined; amount: string; transactionId: string; file: File | null; minAmount?: number | undefined }) {
  const parsed = paymentSchema.safeParse({ amount: input.amount, transaction_id: input.transactionId });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check payment details");
  if (input.minAmount && parsed.data.amount < input.minAmount) throw new Error(`Pay at least ৳${input.minAmount} for you and your guests`);
  let path: string | null = null;
  if (input.file) {
    validateReceipt(input.file);
    const extension = input.file.type === "image/jpeg" ? "jpg" : input.file.type === "image/png" ? "png" : "webp";
    path = `${input.userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("payment-receipts").upload(path, input.file, { contentType: input.file.type });
    if (error) throw error;
  }
  const { error } = await db.from("payments").insert({
    ...parsed.data, user_id: input.userId, purpose: input.purpose, receipt_path: path,
    match_id: input.purpose === "match" ? input.matchId : null, goal_id: input.purpose === "donation" ? input.goalId : null,
  });
  if (error) {
    if (path) await supabase.storage.from("payment-receipts").remove([path]);
    throw new Error(error.code === "23505" ? "This transaction ID has already been submitted" : error.message);
  }
}

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as unknown;
};
// Marks the match played with this team sheet and cost. On a played match it re-settles: old charges are reversed.
export type LineupEntry = { user_id: string; guest_count: number };
export const settleMatch = async (matchId: string, totalCost: number, lineup: LineupEntry[]) => Number(await rpc("settle_match", { _match_id: matchId, _total_cost: totalCost, _lineup: lineup }));
export const recordAdjustment = (playerId: string, amount: number, note: string) => rpc("record_adjustment", { _player_id: playerId, _amount: amount, _note: note.trim() || null });

export async function saveDonationGoal(goal: { id: string; title: string; target_amount: number }) {
  const { data, error } = await supabase.from("donation_goals").update(donationGoalInput(goal.title, goal.target_amount)).eq("id", goal.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("You don't have permission to edit this fund");
}

export async function createDonationGoal(goal: { title: string; target_amount: number }) {
  const { data, error } = await supabase.from("donation_goals").insert(donationGoalInput(goal.title, goal.target_amount)).select("id").single();
  if (error) throw error;
  if (!data) throw new Error("You don't have permission to create a fund");
  return data.id;
}

// Settlement fields on matches (migration 0010), read from the existing match queries' "*" select.
export type Settlement = { total_cost: number | null; cost_per_head: number | null; settled_at: string | null };
export function settlementOf(m: object): Settlement {
  const s = m as Partial<Record<keyof Settlement, unknown>>;
  return {
    total_cost: s.total_cost == null ? null : Number(s.total_cost),
    cost_per_head: s.cost_per_head == null ? null : Number(s.cost_per_head),
    settled_at: typeof s.settled_at === "string" ? s.settled_at : null,
  };
}
