import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const notificationsQuery = (userId: string) => queryOptions({
  queryKey: ["notifications", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  },
  refetchInterval: 60000,
});

export async function markNotificationsRead(id?: string) {
  const { error } = await supabase.rpc("mark_notifications_read", id ? { notification_id: id } : {});
  if (error) throw error;
}