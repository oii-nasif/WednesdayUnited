import { describe, expect, it } from "vitest";
import { prepaymentTotal, verifiedTotal, paymentSchema, validateReceipt } from "@/lib/payment-rules";

describe("prepayment rules", () => {
  it("charges a player for their two guests", () => {
    expect(prepaymentTotal(300, 2)).toBe(900);
  });
  it("counts only verified payments", () => {
    expect(verifiedTotal([{ amount: 300, status: "pending" }, { amount: 500, status: "rejected" }, { amount: 300, status: "verified" }])).toBe(300);
  });
  it("starts each player with zero contributions", () => {
    expect(verifiedTotal([])).toBe(0);
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
  });
});