import { Clock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApproval } from "@/lib/approval";
import { Button } from "@/components/ui/button";

export function ApprovalNotice() {
  const { user, isStaff } = useAuth();
  const approval = useApproval();
  if (!user || isStaff || approval.data === "approved") return null;
  if (approval.isPending) return null;
  const rejected = approval.data === "rejected";
  return (
    <div role="status" className="border-b bg-accent-soft text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        {rejected || approval.isError ? <ShieldAlert className="size-5 shrink-0 text-accent" /> : <Clock className="size-5 shrink-0 text-accent" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{approval.isError ? "Approval status unavailable" : rejected ? "Squad approval declined" : "Squad approval pending"}</p>
          <p className="text-muted-foreground">{approval.isError ? "We couldn't check your approval. Please try again." : rejected ? "Contact a moderator before joining matches." : "A moderator needs to approve your account before you can join matches."}</p>
        </div>
        {approval.isError && <Button variant="outline" size="sm" onClick={() => approval.refetch()}>Retry</Button>}
      </div>
    </div>
  );
}