export function donationGoalInput(title: string, targetAmount: number) {
  const name = title.trim();
  if (!name || name.length > 120) throw new Error("Enter a name up to 120 characters");
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1000000) {
    throw new Error("Enter a target above zero and at most ৳1,000,000");
  }
  return { title: name, target_amount: targetAmount };
}