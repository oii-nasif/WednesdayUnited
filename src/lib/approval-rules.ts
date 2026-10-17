export type ApprovalStatus = "pending" | "approved" | "rejected";

export function canJoinWithApproval(status: ApprovalStatus | null, isStaff: boolean) {
  return isStaff || status === "approved";
}