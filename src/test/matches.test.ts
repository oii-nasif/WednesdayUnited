import { describe, expect, it, vi } from "vitest";
import { participantCount, guestCount, registrationOpen, spotsLabel, quickJoinState } from "@/lib/matches";

describe("match rules", () => {
  it("guests count toward total participants", () => {
    expect(participantCount([{ guest_count: 2 }, { guest_count: 0 }])).toBe(4);
    expect(guestCount([{ guest_count: 2 }, { guest_count: 1 }])).toBe(3);
  });
  it("registration closes after deadline or when not published", () => {
    expect(registrationOpen({ status: "published", registration_deadline: null })).toBe(true);
    expect(registrationOpen({ status: "published", registration_deadline: "2000-01-01T00:00:00Z" })).toBe(false);
    expect(registrationOpen({ status: "cancelled", registration_deadline: null })).toBe(false);
  });
  it("spots label counts down to full and hides without a limit", () => {
    expect(spotsLabel(9, 10)).toBe("1 spot left");
    expect(spotsLabel(4, 10)).toBe("6 spots left");
    expect(spotsLabel(12, 10)).toBe("Full");
    expect(spotsLabel(3, null)).toBeNull();
  });
  it("the October 6 deadline is closed on October 17 even for a booked match", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T18:04:00Z"));
      expect(registrationOpen({ status: "published", registration_deadline: "2026-10-06T17:53:00Z" })).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  describe("quick join from the match card", () => {
    const match = { status: "published", registration_deadline: null, player_limit: 4, registrations: [{ user_id: "a", guest_count: 1 }] };
    const player = { userId: "me", canJoin: true, isStaff: false };
    it("offers join to an approved player while there is room", () => {
      expect(quickJoinState(match, player)).toBe("join");
    });
    it("shows registered players they are in", () => {
      expect(quickJoinState({ ...match, registrations: [{ user_id: "me", guest_count: 0 }] }, player)).toBe("joined");
    });
    it("hides for signed-out, unapproved, closed or non-published matches", () => {
      expect(quickJoinState(match, { ...player, userId: undefined })).toBeNull();
      expect(quickJoinState(match, { ...player, canJoin: false })).toBeNull();
      expect(quickJoinState({ ...match, registration_deadline: "2000-01-01T00:00:00Z" }, player)).toBeNull();
      expect(quickJoinState({ ...match, status: "completed", registrations: [{ user_id: "me", guest_count: 0 }] }, player)).toBeNull();
    });
    it("hides when full, except for staff who may overfill", () => {
      const full = { ...match, registrations: [{ user_id: "a", guest_count: 3 }] };
      expect(quickJoinState(full, player)).toBeNull();
      expect(quickJoinState(full, { ...player, isStaff: true })).toBe("join");
    });
  });
});
