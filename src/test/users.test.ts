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
describe("placeholder members", () => {
  it("validates the member form like the SQL does", async () => {
    const { placeholderSchema } = await import("@/lib/placeholder-rules");
    expect(placeholderSchema.safeParse({ full_name: "A", phone: "" }).success).toBe(false);
    expect(placeholderSchema.safeParse({ full_name: "Rafi", phone: "abc" }).success).toBe(false);
    expect(placeholderSchema.safeParse({ full_name: "  Rafi ", phone: " +880 1711-000000 " }).data).toEqual({ full_name: "Rafi", phone: "+880 1711-000000" });
  });
  it("only offers approved signed-up accounts as merge targets", async () => {
    const { mergeTargets } = await import("@/lib/placeholder-rules");
    const members = [
      { id: "a", placeholder: true, approval_status: "approved", roles: ["player"] },
      { id: "b", placeholder: false, approval_status: "pending", roles: ["player"] },
      { id: "c", placeholder: false, approval_status: "approved", roles: ["player"] },
      { id: "d", placeholder: false, approval_status: "pending", roles: ["player", "moderator"] },
    ];
    expect(mergeTargets(members).map((m) => m.id)).toEqual(["c", "d"]);
  });
  it("creates, edits, removes and merges through the staff checked functions", async () => {
    const { createPlaceholderPlayer, updatePlaceholderPlayer, deletePlaceholderPlayer, mergePlaceholderPlayer } = await import("@/lib/users");
    rpc.mockResolvedValueOnce({ data: "new-id", error: null });
    await expect(createPlaceholderPlayer({ full_name: "Rafi", phone: "" })).resolves.toBe("new-id");
    expect(rpc).toHaveBeenLastCalledWith("create_placeholder_player", { _full_name: "Rafi" });
    rpc.mockResolvedValueOnce({ error: null });
    await updatePlaceholderPlayer("p1", { full_name: "Rafi Ahmed", phone: "01711000000" });
    expect(rpc).toHaveBeenLastCalledWith("update_placeholder_player", { _player_id: "p1", _full_name: "Rafi Ahmed", _phone: "01711000000" });
    rpc.mockResolvedValueOnce({ error: null });
    await deletePlaceholderPlayer("p1");
    expect(rpc).toHaveBeenLastCalledWith("delete_placeholder_player", { _player_id: "p1" });
    rpc.mockResolvedValueOnce({ error: null });
    await mergePlaceholderPlayer("p1", "real");
    expect(rpc).toHaveBeenLastCalledWith("merge_placeholder_player", { _placeholder_id: "p1", _target_id: "real" });
    await expect(createPlaceholderPlayer({ full_name: "X", phone: "" })).rejects.toThrow();
  });
});
