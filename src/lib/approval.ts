import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { ApprovalStatus } from "@/lib/approval-rules";

export function useApproval() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["player-approval", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("approval_status").eq("id", user.id).single();
      if (error) throw error;
      const status = data.approval_status;
      if (status !== "pending" && status !== "approved" && status !== "rejected") throw new Error("Unable to read your squad approval");
      return status as ApprovalStatus;
    },
  });
}