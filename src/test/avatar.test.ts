import { describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), remove: vi.fn(), createSignedUrls: vi.fn() }));
const profiles = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => storage },
    from: () => ({ update: () => ({ eq: () => ({ select: profiles.select }) }) }),
  },
}));
import { AVATAR_MAX_BYTES, isStoredAvatar, removeAvatar, uploadAvatar, validateAvatar } from "@/lib/avatar";

const img = (size: number, type = "image/png") => new File([new Uint8Array(size)], "me.png", { type });

describe("profile photos", () => {
  it("accepts images up to 300 KB and rejects anything else", () => {
    expect(() => validateAvatar(img(AVATAR_MAX_BYTES))).not.toThrow();
    expect(() => validateAvatar(img(AVATAR_MAX_BYTES + 1))).toThrow(/300 KB/);
    expect(() => validateAvatar(img(10, "image/gif"))).toThrow(/JPG, PNG or WebP/);
  });
  it("tells stored paths apart from provider URLs", () => {
    expect(isStoredAvatar("u1/123.png")).toBe(true);
    expect(isStoredAvatar("https://lh3.googleusercontent.com/a/x")).toBe(false);
    expect(isStoredAvatar(null)).toBe(false);
  });
  it("uploads into the owner's folder, saves the path and clears older photos", async () => {
    storage.list.mockResolvedValueOnce({ data: [{ name: "old.png" }] });
    storage.upload.mockResolvedValueOnce({ error: null });
    profiles.select.mockResolvedValueOnce({ data: [{ id: "u1" }], error: null });
    storage.remove.mockResolvedValueOnce({ error: null });
    await expect(uploadAvatar("u1", img(100))).resolves.toMatch(/^u1\/\d+\.png$/);
    expect(storage.upload.mock.calls[0]![0]).toMatch(/^u1\/\d+\.png$/);
    expect(storage.remove).toHaveBeenLastCalledWith(["u1/old.png"]);
  });
  it("rolls back the upload when the profile update is denied", async () => {
    storage.list.mockResolvedValueOnce({ data: [] });
    storage.upload.mockResolvedValueOnce({ error: null });
    profiles.select.mockResolvedValueOnce({ data: [], error: null });
    storage.remove.mockResolvedValueOnce({ error: null });
    await expect(uploadAvatar("u1", img(100))).rejects.toThrow(/Could not save/);
    expect(storage.remove.mock.calls.at(-1)![0][0]).toMatch(/^u1\//);
  });
  it("removing clears the profile and the folder", async () => {
    profiles.select.mockResolvedValueOnce({ data: [{ id: "u1" }], error: null });
    storage.list.mockResolvedValueOnce({ data: [{ name: "a.png" }, { name: "b.png" }] });
    storage.remove.mockResolvedValueOnce({ error: null });
    await removeAvatar("u1");
    expect(storage.remove).toHaveBeenLastCalledWith(["u1/a.png", "u1/b.png"]);
  });
});
