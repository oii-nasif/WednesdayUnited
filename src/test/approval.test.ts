import { beforeEach, describe, expect, it, vi } from "vitest";

const result = vi.hoisted(() => ({ value: { data: null as unknown, error: null as unknown } }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = { select: () => chain, eq: () => chain, order: () => Promise.resolve(result.value), maybeSingle: () => Promise.resolve(result.value) };
  return { supabase: { from: () => chain, rpc: () => Promise.resolve(result.value) } };
});

import { fetchApprovalStatus, joinErrorMessage, squadPlayersQuery, decidePlayerApproval } from "@/lib/approval";

describe("squad approval", () => {
  beforeEach(() => { result.value = { data: null, error: null }; });

  it("reads the stored status", async () => {
    result.value = { data: { approval_status: "pending" }, error: null };
    expect(await fetchApprovalStatus("u1")).toBe("pending");
  });

  it("treats everyone as approved until the migration adds the column", async () => {
    result.value = { data: null, error: { code: "42703", message: "column profiles.approval_status does not exist" } };
    expect(await fetchApprovalStatus("u1")).toBe("approved");
    const players = await squadPlayersQuery.queryFn!({} as never);
    expect(players).toEqual({ available: false, players: [] });
  });

  it("explains a missing approval function instead of failing silently", async () => {
    result.value = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    await expect(decidePlayerApproval("u1", "approved")).rejects.toThrow(/database update/);
  });

  it("turns an RLS rejection into a waiting-for-approval message", () => {
    expect(joinErrorMessage("42501", "new row violates row-level security policy")).toMatch(/waiting/);
    expect(joinErrorMessage("23505", "duplicate key value")).toBe("You're already registered.");
  });
});
