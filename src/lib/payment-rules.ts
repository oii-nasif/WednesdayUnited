import { z } from "zod";

// The database enforces the same cap on every payment submission.
export const MAX_PAYMENT = 2000;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter a positive amount").max(MAX_PAYMENT, `A single payment can be at most ৳${MAX_PAYMENT}`).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "Use at most two decimal places"),
  transaction_id: z.string().trim().min(1, "Enter the transaction ID").max(120),
});

export const prepaymentTotal = (amount: number, guests: number) => Math.round(amount * (1 + guests) * 100) / 100;
export const money = (amount: number) => `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

// Mirrors settle_match: the total cost is split evenly across every head (players plus guests), rounded to paisa.
export function splitCost(total: number, heads: number) {
  if (!(total > 0) || heads <= 0) return 0;
  return Math.round((total / heads) * 100) / 100;
}

// Negative balances are dues; zero or more means the player is clear or holds credit for the next match.
export function balanceState(balance: number) {
  if (balance < 0) return { tone: "due" as const, label: `Due ${money(-balance)}` };
  if (balance > 0) return { tone: "credit" as const, label: `Credit ${money(balance)}` };
  return { tone: "clear" as const, label: "All clear" };
}

export function validateReceipt(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP screenshot");
  if (file.size > 5 * 1024 * 1024) throw new Error("Screenshot must be 5 MB or smaller");
}