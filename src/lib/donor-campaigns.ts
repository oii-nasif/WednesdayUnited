import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import donorImage from "@/assets/donor_appreciation.png.asset.json";

export type DonorCampaign = Tables<"donor_campaigns">;

export const DONOR_ARTWORK: Record<string, { url: string; alt: string }> = {
  "donor-appreciation-2026-11": {
    url: donorImage.url,
    alt: "Thank you, our top donors: Md. Rakibul Alam Tanvi, Md. Jahangir Alam and Md. Kausar",
  },
};

// Unknown or hidden archive entries must never become a public popup.
export function campaignIsDisplayable(campaign: Pick<DonorCampaign, "active" | "asset_key"> | null | undefined) {
  return !!campaign?.active && !!DONOR_ARTWORK[campaign.asset_key];
}

export const activeDonorCampaignQuery = queryOptions({
  queryKey: ["donor-campaigns", "live"],
  queryFn: async (): Promise<DonorCampaign | null> => {
    const { data, error } = await supabase
      .from("donor_campaigns")
      .select("*")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return campaignIsDisplayable(data) ? data : null;
  },
  staleTime: 30_000,
});

export const donorCampaignArchiveQuery = queryOptions({
  queryKey: ["donor-campaigns", "archive"],
  queryFn: async (): Promise<DonorCampaign[]> => {
    const { data, error } = await supabase.from("donor_campaigns").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export async function setDonorCampaignVisibility(campaignId: string, makeLive: boolean) {
  const { error } = await supabase.rpc("set_donor_campaign_visibility", { campaign_id: campaignId, make_live: makeLive });
  if (error) throw error;
}
