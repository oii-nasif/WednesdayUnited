import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { campaignIsDisplayable, setDonorCampaignVisibility } from "@/lib/donor-campaigns";

describe("donor banner visibility", () => {
  it("only displays a live banner with known artwork", () => {
    expect(campaignIsDisplayable({ active: false, asset_key: "donor-appreciation-2026-11" })).toBe(false);
    expect(campaignIsDisplayable({ active: true, asset_key: "donor-appreciation-2026-11" })).toBe(true);
    expect(campaignIsDisplayable({ active: true, asset_key: "unknown" })).toBe(false);
  });

  it("uses the super-admin checked visibility function", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await setDonorCampaignVisibility("campaign-id", true);
    expect(rpc).toHaveBeenLastCalledWith("set_donor_campaign_visibility", { campaign_id: "campaign-id", make_live: true });
    rpc.mockResolvedValueOnce({ error: null });
    await setDonorCampaignVisibility("campaign-id", false);
    expect(rpc).toHaveBeenLastCalledWith("set_donor_campaign_visibility", { campaign_id: "campaign-id", make_live: false });
  });
});
