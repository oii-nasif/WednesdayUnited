import { describe, expect, it } from "vitest";
import { prepaymentTotal, paymentSchema, validateReceipt, splitCost, balanceState, MAX_PAYMENT } from "@/lib/payment-rules";

describe("prepayment rules", () => {
  it("charges a player for their two guests", () => {
    expect(prepaymentTotal(300, 2)).toBe(900);
  });
  it("splits the match cost per head, guests included", () => {
    expect(splitCost(1200, 4)).toBe(300);
    expect(splitCost(1000, 3)).toBe(333.33);
    expect(splitCost(1200, 0)).toBe(0);
    expect(splitCost(0, 4)).toBe(0);
  });
  it("shows dues in red and credit or zero as clear", () => {
    expect(balanceState(-600)).toEqual({ tone: "due", label: "Due ৳600" });
    expect(balanceState(100).tone).toBe("credit");
    expect(balanceState(0)).toEqual({ tone: "clear", label: "All clear" });
  });
  it("caps a single payment at 2000", () => {
    expect(MAX_PAYMENT).toBe(2000);
    expect(paymentSchema.safeParse({ amount: 2000, transaction_id: "TX" }).success).toBe(true);
    expect(paymentSchema.safeParse({ amount: 2000.01, transaction_id: "TX" }).success).toBe(false);
  });
  it("requires a positive amount and transaction ID", () => {
    expect(paymentSchema.safeParse({ amount: 0, transaction_id: "TX" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: 300, transaction_id: " " }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: 300.001, transaction_id: "TX" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: 300, transaction_id: "TX" }).success).toBe(true);
  });
  it("accepts screenshots but rejects unsafe files", () => {
    expect(() => validateReceipt(new File(["photo"], "receipt.png", { type: "image/png" }))).not.toThrow();
    expect(() => validateReceipt(new File(["script"], "receipt.svg", { type: "image/svg+xml" }))).toThrow();
    expect(() => validateReceipt(new File([new Uint8Array(1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }))).toThrow(/1 MB/);
    expect(() => validateReceipt(new File([new Uint8Array(1024 * 1024)], "ok.jpg", { type: "image/jpeg" }))).not.toThrow();
  });
});