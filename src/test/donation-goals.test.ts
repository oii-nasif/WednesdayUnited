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
describe("fund panel copy", async () => {
  const { fundShare, fundStage, timeAgo, firstName } = await import("@/lib/donation-rules");
  it("splits what is left into a round per-player share", () => {
    expect(fundShare(2800, 13)).toEqual({ players: 13, share: 250 });
    expect(fundShare(2800, 0)).toEqual({ players: 10, share: 300 });
    expect(fundShare(120, 20)).toEqual({ players: 20, share: 50 });
    expect(fundShare(12000, 10)).toEqual({ players: 10, share: 1200 });
  });
  it("frames progress in football terms", () => {
    expect(fundStage(0)).toMatch(/first/);
    expect(fundStage(50)).toMatch(/half-time/);
    expect(fundStage(92)).toMatch(/Stoppage/);
    expect(fundStage(100)).toMatch(/Back of the net/);
  });
  it("describes when a donation landed", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    expect(timeAgo("2026-10-26T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-26T11:15:00Z", now)).toBe("45 min ago");
    expect(timeAgo("2026-10-26T09:00:00Z", now)).toBe("3 hrs ago");
    expect(timeAgo("2026-10-24T12:00:00Z", now)).toBe("2 days ago");
    expect(firstName("Rafi Ahmed")).toBe("Rafi");
    expect(firstName(null)).toBe("A player");
  });
});
