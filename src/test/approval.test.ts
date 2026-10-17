import { describe, expect, it } from "vitest";
import { canJoinWithApproval } from "@/lib/approval-rules";

describe("squad approval", () => {
  it("pending players cannot join", () => {
    expect(canJoinWithApproval("pending", false)).toBe(false);
  });
  it("rejected players cannot join", () => {
    expect(canJoinWithApproval("rejected", false)).toBe(false);
  });
  it("approved players can join", () => {
    expect(canJoinWithApproval("approved", false)).toBe(true);
  });
  it("staff can join without player approval", () => {
    expect(canJoinWithApproval("pending", true)).toBe(true);
  });
  it("unknown approval does not allow player registration", () => {
    expect(canJoinWithApproval(null, false)).toBe(false);
  });
});