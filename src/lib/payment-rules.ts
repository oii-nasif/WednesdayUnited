import { z } from "zod";

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter a positive amount").max(9999999999.99).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "Use at most two decimal places"),
  transaction_id: z.string().trim().min(1, "Enter the transaction ID").max(120),
});

export const prepaymentTotal = (amount: number, guests: number) => Math.round(amount * (1 + guests) * 100) / 100;
export const verifiedTotal = (payments: { amount: number; status: string }[]) => payments.reduce((sum, p) => sum + (p.status === "verified" ? Number(p.amount) : 0), 0);
export const money = (amount: number) => `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export function validateReceipt(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP screenshot");
  if (file.size > 5 * 1024 * 1024) throw new Error("Screenshot must be 5 MB or smaller");
}