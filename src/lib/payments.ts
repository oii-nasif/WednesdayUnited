import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const paymentSettingsQuery = queryOptions({
  queryKey: ["payment-settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("payment_settings").select("*").maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const paymentsQuery = (userId: string, team = false) => queryOptions({
  queryKey: ["payments", userId, team],
  queryFn: async () => {
    let query = supabase.from("payments").select("*, profile:profiles!payments_user_id_fkey(full_name), match:matches(starts_at, location:locations(name))").order("created_at", { ascending: false });
    if (!team) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
});