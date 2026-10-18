import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ insert: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: async (row: unknown) => { calls.insert(row); return { error: null }; } }),
    rpc: async (fn: string, args: unknown) => calls.rpc(fn, args),
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({}) }) },
  },
}));
import { matchDuesQuery, settleMatch, submitPayment, recordAdjustment } from "@/lib/ledger";

const base = { userId: "u1", amount: "500", transactionId: " TX-1 ", file: null };

describe("ledger client", () => {
  beforeEach(() => { calls.insert.mockReset(); calls.rpc.mockReset(); });

  it("files each payment purpose against the right target only", async () => {
    await submitPayment({ ...base, purpose: "advance", matchId: "m1", goalId: "g1" });
    expect(calls.insert).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: "advance", match_id: null, goal_id: null, amount: 500, transaction_id: "TX-1" }));
    await submitPayment({ ...base, purpose: "donation", goalId: "g1" });
    expect(calls.insert).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: "donation", match_id: null, goal_id: "g1" }));
    await submitPayment({ ...base, purpose: "match", matchId: "m1" });
    expect(calls.insert).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: "match", match_id: "m1", goal_id: null }));
  });

  it("refuses payments over the 2000 limit before sending anything", async () => {
    await expect(submitPayment({ ...base, purpose: "advance", amount: "2500" })).rejects.toThrow(/2000/);
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it("settles and adjusts through the staff-checked functions", async () => {
    calls.rpc.mockResolvedValueOnce({ data: 300, error: null });
    await expect(settleMatch("m1", 1200, [{ user_id: "u1", guest_count: 1 }])).resolves.toBe(300);
    expect(calls.rpc).toHaveBeenLastCalledWith("settle_match", { _match_id: "m1", _total_cost: 1200, _lineup: [{ user_id: "u1", guest_count: 1 }] });
    calls.rpc.mockResolvedValueOnce({ data: null, error: { message: "Only moderators can adjust balances" } });
    await expect(recordAdjustment("u2", 300, "Cash")).rejects.toThrow("Only moderators");
    calls.rpc.mockResolvedValueOnce({ data: null, error: null });
    await recordAdjustment("u2", 300, "  ");
    expect(calls.rpc).toHaveBeenLastCalledWith("record_adjustment", { _player_id: "u2", _amount: 300, _note: null });
  });

  it("maps match dues by player with numeric amounts", async () => {
    calls.rpc.mockResolvedValueOnce({ data: [{ user_id: "u1", charged: "300.00", covered: "300.00", due: "0.00" }, { user_id: "u2", charged: "600.00", covered: "0", due: "600.00" }], error: null });
    const dues = await matchDuesQuery("m1").queryFn!({} as never);
    expect(dues.get("u1")?.due).toBe(0);
    expect(dues.get("u2")).toEqual({ user_id: "u2", charged: 600, covered: 0, due: 600 });
  });
});
