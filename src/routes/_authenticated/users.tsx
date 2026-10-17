import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Check, X, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usersQuery, decideApproval, setPlayerRole, canManageRole } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [
    { title: "Squad Users — Wednesday United" },
    { name: "description", content: "Review Wednesday United player approvals and manage squad roles." },
    { property: "og:title", content: "Squad Users — Wednesday United" },
    { property: "og:description", content: "Player approvals and squad role management." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: UsersPage,
});

type Action = { id: string; name: string; type: "approval"; value: "approved" | "rejected" } | { id: string; name: string; type: "role"; value: "player" | "moderator" };
function UsersPage() {
  const { isStaff, roles, loading } = useAuth();
  const qc = useQueryClient();
  const { data = [], isPending, isError, refetch } = useQuery({ ...usersQuery, enabled: isStaff });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [action, setAction] = useState<Action | null>(null);
  const update = useMutation({
    mutationFn: async (a: Action) => a.type === "approval" ? decideApproval(a.id, a.value) : setPlayerRole(a.id, a.value),
    onSuccess: () => { toast.success("User updated"); setAction(null); qc.invalidateQueries({ queryKey: ["staff-users"] }); qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["approval"] }); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not update user"),
  });
  if (loading) return null;
  if (!isStaff) return <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Only admins and moderators can manage users.</div>;
  const visible = data.filter((p) => (filter === "all" || (filter === "moderator" ? p.roles.includes("moderator") : p.approval_status === filter)) && `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter mx-auto max-w-6xl px-4 py-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-accent">Team operations</p><h1 className="mt-2 text-5xl">Squad users</h1></div><div className="flex gap-5 text-sm"><span className="flex items-center gap-2"><UsersIcon className="size-4 text-primary" />{data.length} users</span><span className="font-semibold text-accent">{data.filter((p) => p.approval_status === "pending").length} pending</span></div></div>
    <div className="mb-6 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search users" placeholder="Search name or email" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44" aria-label="Filter users"><SelectValue /></SelectTrigger><SelectContent>{["all", "pending", "approved", "rejected", "moderator"].map((f) => <SelectItem key={f} value={f}>{f === "all" ? "All users" : f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>)}</SelectContent></Select></div>
    {isPending ? <p className="py-8 text-muted-foreground">Loading users…</p> : isError ? <div role="alert"><p>Could not load users.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div> : !visible.length ? <p className="py-8 text-muted-foreground">No users found.</p> : <ul className="divide-y border-y">{visible.map((p) => {
      const staff = p.roles.includes("moderator") || p.roles.includes("super_admin");
      const role = p.roles.includes("super_admin") ? "Super admin" : staff ? "Moderator" : "Player";
      return <li key={p.id} className="flex flex-wrap items-center gap-4 py-5" data-user-id={p.id}>
        <Avatar className="size-11"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.full_name ?? "P").slice(0,1)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1 basis-40"><p className="break-words font-semibold">{p.full_name ?? "Player"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{p.email}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant={staff ? "secondary" : "outline"}>{role}</Badge><Badge variant={p.approval_status === "rejected" ? "destructive" : "outline"}>{staff ? "Approved" : p.approval_status}</Badge></div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {!staff && p.approval_status !== "approved" && <Button variant="outline" size="sm" onClick={() => setAction({ id:p.id, name:p.full_name ?? "Player", type:"approval", value:"approved" })}><Check className="size-4" />Approve</Button>}
          {!staff && p.approval_status !== "rejected" && <Button variant="ghost" size="sm" onClick={() => setAction({ id:p.id, name:p.full_name ?? "Player", type:"approval", value:"rejected" })}><X className="size-4" />{p.approval_status === "approved" ? "Revoke approval" : "Reject"}</Button>}
          {canManageRole(roles, p.roles) && <Button variant="secondary" size="sm" onClick={() => setAction({ id:p.id, name:p.full_name ?? "Player", type:"role", value:staff ? "player" : "moderator" })}><Shield className="size-4" />{staff ? "Make player" : "Make moderator"}</Button>}
        </div>
      </li>;
    })}</ul>}
    <Dialog open={!!action} onOpenChange={(o) => { if (!o && !update.isPending) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{action?.type === "role" ? "Change squad role" : "Review squad approval"}</DialogTitle><DialogDescription>{action && (action.type === "role" ? `Make ${action.name} a ${action.value}?` : `${action.value === "approved" ? "Approve" : "Reject or revoke approval for"} ${action.name}?`)}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={update.isPending} onClick={() => setAction(null)}>Cancel</Button><Button disabled={update.isPending} onClick={() => { if (action) update.mutate(action); }}>{update.isPending ? "Saving…" : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}