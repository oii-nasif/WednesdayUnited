import { beforeEach, describe, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), sign: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: calls.from } } }));
import { paymentQrUrl, uploadPaymentQr } from "@/lib/payment-qr";

describe("private payment QR storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.from.mockReturnValue({ upload: calls.upload, createSignedUrl: calls.sign });
    calls.upload.mockResolvedValue({ error: null });
    calls.sign.mockResolvedValue({ data: { signedUrl: "https://example.test/signed-qr" }, error: null });
  });
  it("uploads separately from receipts under the account folder", async () => {
    const file = new File(["image"], "qr.png", { type: "image/png" });
    const path = await uploadPaymentQr("admin-id", file);
    expect(calls.from).toHaveBeenCalledWith("payment-qr-codes");
    expect(path).toMatch(/^admin-id\/.+\.png$/);
    expect(calls.upload).toHaveBeenCalledWith(path, file, { contentType: "image/png" });
  });
  it("uses expiring links for QR reads", async () => {
    await expect(paymentQrUrl("admin/qr.png")).resolves.toBe("https://example.test/signed-qr");
    expect(calls.sign).toHaveBeenCalledWith("admin/qr.png", 600);
  });
  it("rejects unsafe images before upload", async () => {
    await expect(uploadPaymentQr("admin", new File(["svg"], "qr.svg", { type: "image/svg+xml" }))).rejects.toThrow();
    expect(calls.upload).not.toHaveBeenCalled();
  });
});