import { Mail, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const approvalLabel: Record<string, string> = { approved: "Approved", pending: "Waiting for approval", rejected: "Not approved" };

export function ProfileSummary({ profile, role }: { profile: { full_name: string | null; email: string | null; avatar_url: string | null; approval_status: string }; role: string }) {
  const name = profile.full_name ?? "Player";
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-6 shadow-card">
      <Avatar className="size-20 ring-4 ring-primary-soft"><AvatarImage src={profile.avatar_url ?? undefined} alt="" /><AvatarFallback className="bg-primary text-2xl text-primary-foreground">{name.slice(0, 1)}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-4xl leading-none">{name}</h2>
        <p className="mt-2 flex items-center gap-2 break-all text-sm text-muted-foreground"><Mail className="size-4 shrink-0" />{profile.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary"><ShieldCheck className="size-3.5" />{role}</Badge>
          <Badge variant={profile.approval_status === "approved" ? "secondary" : "outline"}>{approvalLabel[profile.approval_status] ?? profile.approval_status}</Badge>
        </div>
      </div>
    </section>
  );
}
