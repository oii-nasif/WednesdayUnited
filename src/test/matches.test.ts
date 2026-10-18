import { describe, expect, it, vi } from "vitest";
import { participantCount, guestCount, maxGuests, registrationOpen, spotsLabel } from "@/lib/matches";

describe("match rules", () => {
  it("guest cap uses the match setting and falls back to 5", () => {
    expect(maxGuests({ max_guests: 2 })).toBe(2);
    expect(maxGuests({ max_guests: 0 })).toBe(0);
    expect(maxGuests({})).toBe(5);
  });
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
});
