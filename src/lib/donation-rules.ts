export function donationGoalInput(title: string, targetAmount: number) {
  const name = title.trim();
  if (!name || name.length > 120) throw new Error("Enter a name up to 120 characters");
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1000000) {
    throw new Error("Enter a target above zero and at most ৳1,000,000");
  }
  return { title: name, target_amount: targetAmount };
}

// Turns "৳2,800 to go" into a share each player can picture: split across the squad, rounded up to a round number,
// never below ৳50. Falls back to ten players when the squad size is unknown.
export function fundShare(needed: number, squad: number | null | undefined) {
  const players = squad && squad >= 2 ? squad : 10;
  const raw = needed / players;
  const step = raw > 500 ? 100 : raw > 100 ? 50 : 10;
  return { players, share: Math.max(50, Math.ceil(raw / step) * step) };
}

// Football framing for how far the fund has come.
export function fundStage(pct: number) {
  if (pct >= 100) return "Full time. Back of the net!";
  if (pct >= 90) return "Stoppage time. One more push!";
  if (pct >= 75) return "Final stretch. Almost there!";
  if (pct >= 50) return "Past half-time!";
  if (pct >= 25) return "Good start. Keep it rolling!";
  if (pct > 0) return "Kicked off. Every ৳ counts!";
  return "Be the first to chip in";
}

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return `${Math.round(days / 7)} wk ago`;
}

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "A player";
