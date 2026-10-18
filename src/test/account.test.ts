import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn() }));
const update = vi.hoisted(() => ({ result: { data: [{ id: "u1" }] as unknown[] | null, error: null as unknown }, values: null as unknown }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth,
    from: () => ({ update: (values: unknown) => { update.values = values; return { eq: () => ({ select: async () => update.result }) }; } }),
  },
}));
import { authErrorMessage, createAccount, signUpSchema } from "@/lib/account";
import { isPosition, updateMyPosition } from "@/lib/profile";

const valid = { full_name: "Sam Player", email: " Sam@Example.com ", password: "goodpass1", confirm: "goodpass1" };

describe("account creation", () => {
  beforeEach(() => { auth.signUp.mockReset(); });

  it("rejects short passwords and mismatched confirmation", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "short", confirm: "short" }).success).toBe(false);
    const mismatch = signUpSchema.safeParse({ ...valid, confirm: "different1" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirm"]);
  });

  it("signs up with a normalised email and the player's name", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { identities: [{}] }, session: null }, error: null });
    await expect(createAccount(valid)).resolves.toEqual({ needsConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "sam@example.com", password: "goodpass1", options: expect.objectContaining({ data: { full_name: "Sam Player" } }) }));
  });

  it("reports an existing email even when confirmation hides the error", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: { identities: [] }, session: null }, error: null });
    await expect(createAccount(valid)).rejects.toThrow("already exists");
  });

  it("explains common auth errors", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Wrong email or password.");
    expect(authErrorMessage("Email not confirmed")).toMatch(/Confirm your email/);
  });
});

describe("player position", () => {
  it("accepts only the five positions", () => {
    expect(["GK", "DEF", "MID", "FWD", "ALL"].every(isPosition)).toBe(true);
    expect(isPosition("Striker")).toBe(false);
  });

  it("updates only the position and fails when no row comes back", async () => {
    update.result = { data: [{ id: "u1" }], error: null };
    await updateMyPosition("u1", "MID");
    expect(update.values).toEqual({ position: "MID" });
    update.result = { data: [], error: null };
    await expect(updateMyPosition("u1", "GK")).rejects.toThrow();
  });
});
