import { describe, expect, it } from "vitest";
import { participantCount, guestCount, registrationOpen } from "@/lib/matches";

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
});
