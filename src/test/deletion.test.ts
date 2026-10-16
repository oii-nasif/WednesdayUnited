import { describe, expect, it, vi, beforeEach } from "vitest";

const { select, eq, remove, from } = vi.hoisted(() => {
  const select = vi.fn();
  const eq = vi.fn(() => ({ select }));
  const remove = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: remove }));
  return { select, eq, remove, from };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { deleteEntity } from "@/lib/deletion";

describe("deletion", () => {
  beforeEach(() => vi.clearAllMocks());
  it("deletes the requested match and confirms a returned row", async () => {
    select.mockResolvedValue({ data: [{ id: "match-1" }], error: null });
    await deleteEntity("match", "match-1");
    expect(from).toHaveBeenCalledWith("matches");
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", "match-1");
  });
  it("deletes the requested venue", async () => {
    select.mockResolvedValue({ data: [{ id: "venue-1" }], error: null });
    await deleteEntity("venue", "venue-1");
    expect(from).toHaveBeenCalledWith("locations");
    expect(eq).toHaveBeenCalledWith("id", "venue-1");
  });
  it("does not claim deletion when permission filters out a row", async () => {
    select.mockResolvedValue({ data: [], error: null });
    await expect(deleteEntity("match", "match-1")).rejects.toThrow("was not deleted");
  });
  it("preserves matches with payment references", async () => {
    select.mockResolvedValue({ data: null, error: { code: "23503" } });
    await expect(deleteEntity("match", "match-1")).rejects.toThrow("payment records");
  });
  it("preserves venues used by matches", async () => {
    select.mockResolvedValue({ data: null, error: { code: "23503" } });
    await expect(deleteEntity("venue", "venue-1")).rejects.toThrow("used by a match");
  });
});