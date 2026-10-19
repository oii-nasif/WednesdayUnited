import { describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => db } }));
import { createDonationGoal, donationGoalsQuery } from "@/lib/ledger";
import { donationGoalInput } from "@/lib/donation-rules";

describe("donation goals", () => {
  it("creates a separate goal without closing existing funds", async () => {
    db.insert.mockReturnValue(db); db.select.mockReturnValue(db);
    db.single.mockResolvedValue({ data: { id: "new-goal" }, error: null });
    await expect(createDonationGoal({ title: " Team kit ", target_amount: 5000 })).resolves.toBe("new-goal");
    expect(db.insert).toHaveBeenCalledWith({ title: "Team kit", target_amount: 5000 });
  });
  it("reads several active funds without requiring a single row", async () => {
    db.select.mockReturnValue(db); db.eq.mockReturnValue(db);
    db.order.mockReturnValueOnce(db).mockResolvedValueOnce({ data: [
      { id: "kit", title: "Team kit", target_amount: 5000, collected_amount: 0, active: true },
      { id: "ball", title: "Match ball", target_amount: 3500, collected_amount: 100, active: true },
    ], error: null });
    const read = donationGoalsQuery.queryFn;
    if (!read) throw new Error("Missing goal reader");
    const goals = await read({} as never);
    expect(goals.map((g) => g.id)).toEqual(["kit", "ball"]);
    expect(db.eq).toHaveBeenCalledWith("active", true);
  });
  it("preserves staff permission errors from the database", async () => {
    db.single.mockResolvedValue({ data: null, error: new Error("Staff only") });
    await expect(createDonationGoal({ title: "Team kit", target_amount: 5000 })).rejects.toThrow("Staff only");
  });
  it("rejects invalid targets before saving", () => {
    for (const amount of [NaN, Infinity, 0, -1, 1000001]) expect(() => donationGoalInput("Kit", amount)).toThrow();
    expect(donationGoalInput("Kit", 1000000).target_amount).toBe(1000000);
  });
});