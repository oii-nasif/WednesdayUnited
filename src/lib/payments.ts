import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentPurpose } from "@/lib/ledger";

export const paymentSettingsQuery = queryOptions({
  queryKey: ["payment-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("payment_settings").select("*").maybeSingle();
    if (error) throw error;
    return data;
  },
});

async function fetchPayments(userId: string, team: boolean) {
    let query = supabase.from("payments").select("*, profile:profiles!payments_user_id_fkey(full_name), match:matches(starts_at, location:locations(name))").order("created_at", { ascending: false });
    if (!team) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    // purpose/goal_id and the now-optional match_id come from migration 0010, ahead of the generated types.
    return (data ?? []) as (Omit<NonNullable<typeof data>[number], "match_id"> & { match_id: string | null; purpose: PaymentPurpose; goal_id: string | null })[];
}

export const purposeLabel: Record<PaymentPurpose, string> = { match: "Match", advance: "Balance top-up", donation: "Donation" };
export type PaymentRow = Awaited<ReturnType<typeof fetchPayments>>[number];
export const paymentsQuery = (userId: string, team = false) => queryOptions({
  queryKey: ["payments", userId, team],
  queryFn: () => fetchPayments(userId, team),
});