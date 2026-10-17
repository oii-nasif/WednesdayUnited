import { describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { canManageRole, decideApproval, setPlayerRole } from "@/lib/users";
import { markNotificationsRead } from "@/lib/notifications";
describe("user management permissions", () => {
  it("only super admins manage moderator roles", () => {
    expect(canManageRole(["player"], ["player"])).toBe(false);
    expect(canManageRole(["moderator"], ["player"])).toBe(false);
    expect(canManageRole(["super_admin"], ["player"])).toBe(true);
  });
  it("super admin targets are protected", () => {
    expect(canManageRole(["super_admin"], ["player", "super_admin"])).toBe(false);
  });
  it("approval uses the staff checked decision function", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await decideApproval("player-id", "approved");
    expect(rpc).toHaveBeenLastCalledWith("decide_player_approval", { player_id: "player-id", decision: "approved" });
  });
  it("moderator changes use the admin checked function", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await setPlayerRole("player-id", "moderator");
    expect(rpc).toHaveBeenLastCalledWith("set_player_role", { player_id: "player-id", new_role: "moderator" });
  });
  it("mark all read does not supply a different owner", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await markNotificationsRead();
    expect(rpc).toHaveBeenLastCalledWith("mark_notifications_read", {});
  });
});