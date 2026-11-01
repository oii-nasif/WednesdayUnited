import { z } from "zod";

// The database enforces the same cap on every payment submission.
export const MAX_PAYMENT = 2000;

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter a positive amount").max(MAX_PAYMENT, `A single payment can be at most ৳${MAX_PAYMENT}`).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, "Use at most two decimal places"),
  transaction_id: z.string().trim().min(1, "Enter the transaction ID").max(120),
});

// A donation added to a match or balance payment rides on the same transfer, so the ৳2000 cap covers both.
export function withDonation(amount: number, donation: number) {
  if (!(donation > 0) || Math.abs(donation * 100 - Math.round(donation * 100)) >= 0.0001) throw new Error("Enter a donation above zero, with at most two decimal places");
  const total = Math.round((amount + donation) * 100) / 100;
  if (total > MAX_PAYMENT) throw new Error(`Payment and donation together can be at most ৳${MAX_PAYMENT}`);
  return total;
}

export const prepaymentTotal = (amount: number, guests: number) => Math.round(amount * (1 + guests) * 100) / 100;
// Whole taka only: per-head splits produce fractions, but nobody pays ৳308.57.
export const money = (amount: number) => `৳${Math.round(amount).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

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
  // Matches the payment-receipts bucket limit (1 MB) set in Lovable storage.
  if (file.size > 1024 * 1024) throw new Error("Screenshot must be 1 MB or smaller. Try a cropped or compressed image");
}