import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Search, Check, X, Shield, Users as UsersIcon, UserRoundPlus, Merge, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usersQuery, decideApproval, setPlayerRole, canManageRole, createPlaceholderPlayer, updatePlaceholderPlayer, deletePlaceholderPlayer, mergePlaceholderPlayer, type StaffUser } from "@/lib/users";
import { mergeTargets, placeholderSchema, type PlaceholderInput } from "@/lib/placeholder-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarPhoto } from "@/components/AvatarPhoto";
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

const FILTERS: [string, string][] = [["all", "All users"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["moderator", "Moderator"], ["placeholder", "Not signed up"]];
type Action =
  | { id: string; name: string; type: "approval"; value: "approved" | "rejected" }
  | { id: string; name: string; type: "role"; value: "player" | "moderator" }
  | { id: string; name: string; type: "remove" };
type MemberForm = { id?: string; full_name: string; phone: string };

function UsersPage() {
  const { user, isStaff, roles, loading } = useAuth();
  const qc = useQueryClient();
  const { data = [], isPending, isError, refetch } = useQuery({ ...usersQuery(user?.id ?? ""), enabled: isStaff });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [action, setAction] = useState<Action | null>(null);
  const [member, setMember] = useState<MemberForm | null>(null);
  const [merging, setMerging] = useState<StaffUser | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["staff-users"] }); qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["player-approval"] }); };
  const update = useMutation({
    mutationFn: async (a: Action) => a.type === "approval" ? decideApproval(a.id, a.value) : a.type === "role" ? setPlayerRole(a.id, a.value) : deletePlaceholderPlayer(a.id),
    onSuccess: (_, a) => { toast.success(a.type === "remove" ? "Member removed" : "User updated"); setAction(null); refresh(); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not update user"),
  });
  if (loading) return null;
  if (!isStaff) return <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Only admins and moderators can manage users.</div>;
  const matches = (p: StaffUser) => filter === "all" || (filter === "moderator" ? p.roles.includes("moderator") : filter === "placeholder" ? p.placeholder : !p.placeholder && p.approval_status === filter);
  const visible = data.filter((p) => matches(p) && `${p.full_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter mx-auto max-w-6xl px-4 py-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase text-accent">Team operations</p><h1 className="mt-2 text-5xl">Squad users</h1></div>
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <span className="flex items-center gap-2"><UsersIcon className="size-4 text-primary" />{data.length} users</span>
        <span className="font-semibold text-accent">{data.filter((p) => !p.placeholder && p.approval_status === "pending").length} pending</span>
        <Button onClick={() => setMember({ full_name: "", phone: "" })}><UserRoundPlus />Add member</Button>
      </div>
    </div>
    <div className="mb-6 flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search users" placeholder="Search name, email or phone" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-44" aria-label="Filter users"><SelectValue /></SelectTrigger><SelectContent>{FILTERS.map(([f, label]) => <SelectItem key={f} value={f}>{label}</SelectItem>)}</SelectContent></Select></div>
    {isPending ? <p className="py-8 text-muted-foreground">Loading users…</p> : isError ? <div role="alert"><p>Could not load users.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div> : !visible.length ? <p className="py-8 text-muted-foreground">No users found.</p> : <ul className="divide-y border-y">{visible.map((p) => {
      const staff = p.roles.includes("moderator") || p.roles.includes("super_admin");
      const role = p.roles.includes("super_admin") ? "Super admin" : staff ? "Moderator" : "Player";
      const name = p.full_name ?? "Player";
      return <li key={p.id} className="flex flex-wrap items-center gap-4 py-5" data-user-id={p.id}>
        <Avatar className="size-11"><AvatarPhoto src={p.avatar_url} /><AvatarFallback>{name.slice(0,1)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1 basis-40"><Link to="/players/$id" params={{ id: p.id }} className="break-words font-semibold hover:text-primary hover:underline">{name}</Link><p className="mt-1 break-all text-xs text-muted-foreground">{p.placeholder ? (p.phone ?? "No phone number") : p.email}</p></div>
        {p.placeholder
          ? <div className="flex flex-wrap items-center gap-2"><Badge variant="outline"><UserRoundPlus className="size-3" />Not signed up</Badge></div>
          : <div className="flex flex-wrap items-center gap-2"><Badge variant={staff ? "secondary" : "outline"}>{role}</Badge><Badge variant={p.approval_status === "rejected" ? "destructive" : "outline"}>{staff ? "Approved" : p.approval_status}</Badge></div>}
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {p.placeholder ? <>
            <Button variant="outline" size="sm" onClick={() => setMerging(p)}><Merge className="size-4" />Merge into account</Button>
            <Button variant="ghost" size="sm" aria-label={`Edit ${name}`} onClick={() => setMember({ id: p.id, full_name: p.full_name ?? "", phone: p.phone ?? "" })}><Pencil className="size-4" />Edit</Button>
            <Button variant="ghost" size="sm" aria-label={`Remove ${name}`} onClick={() => setAction({ id: p.id, name, type: "remove" })}><Trash2 className="size-4" />Remove</Button>
          </> : <>
            {!staff && p.approval_status !== "approved" && <Button variant="outline" size="sm" onClick={() => setAction({ id:p.id, name, type:"approval", value:"approved" })}><Check className="size-4" />Approve</Button>}
            {!staff && p.approval_status !== "rejected" && <Button variant="ghost" size="sm" onClick={() => setAction({ id:p.id, name, type:"approval", value:"rejected" })}><X className="size-4" />{p.approval_status === "approved" ? "Revoke approval" : "Reject"}</Button>}
            {canManageRole(roles, p.roles) && <Button variant="secondary" size="sm" onClick={() => setAction({ id:p.id, name, type:"role", value:staff ? "player" : "moderator" })}><Shield className="size-4" />{staff ? "Make player" : "Make moderator"}</Button>}
          </>}
        </div>
      </li>;
    })}</ul>}
    <Dialog open={!!action} onOpenChange={(o) => { if (!o && !update.isPending) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{action?.type === "role" ? "Change squad role" : action?.type === "remove" ? "Remove member" : "Review squad approval"}</DialogTitle><DialogDescription>{action && (action.type === "role" ? `Make ${action.name} a ${action.value}?` : action.type === "remove" ? `Remove ${action.name}? This only works while nothing has been recorded against them. If they have games or a balance, merge them into their account instead.` : `${action.value === "approved" ? "Approve" : "Reject or revoke approval for"} ${action.name}?`)}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={update.isPending} onClick={() => setAction(null)}>Cancel</Button><Button variant={action?.type === "remove" ? "destructive" : "default"} disabled={update.isPending} onClick={() => { if (action) update.mutate(action); }}>{update.isPending ? "Saving…" : "Confirm"}</Button></DialogFooter></DialogContent></Dialog>
    <MemberDialog key={member?.id ?? (member ? "new" : "closed")} member={member} onClose={() => setMember(null)} onSaved={refresh} />
    <MergeDialog key={merging?.id ?? "none"} placeholder={merging} targets={mergeTargets(data)} onClose={() => setMerging(null)} onMerged={() => { refresh(); qc.invalidateQueries({ queryKey: ["ledger"] }); qc.invalidateQueries({ queryKey: ["balances"] }); }} />
  </div>;
}

// Add or edit a member who has not signed up: name and an optional phone number so staff know who they are.
function MemberDialog({ member, onClose, onSaved }: { member: MemberForm | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PlaceholderInput>({ full_name: member?.full_name ?? "", phone: member?.phone ?? "" });
  const [errors, setErrors] = useState<Partial<Record<keyof PlaceholderInput, string>>>({});
  const save = useMutation({
    mutationFn: async () => { if (member?.id) await updatePlaceholderPlayer(member.id, form); else await createPlaceholderPlayer(form); },
    onSuccess: () => { toast.success(member?.id ? "Member updated" : "Member added"); onSaved(); onClose(); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not save member"),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = placeholderSchema.safeParse(form);
    if (!check.success) { setErrors(Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setErrors({});
    save.mutate();
  };
  return <Dialog open={!!member} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">{member?.id ? "Edit member" : "Add a member"}</DialogTitle><DialogDescription>{member?.id ? "Update the name staff see for this member." : "For someone who plays but has not signed up yet. They can be put on team sheets and charged like anyone else. When they sign up, merge this entry into their account."}</DialogDescription></DialogHeader>
      <form id="member-form" className="grid gap-4" onSubmit={submit} noValidate>
        <div className="grid gap-1.5"><Label htmlFor="member-name">Name</Label><Input id="member-name" autoFocus maxLength={80} value={form.full_name} aria-invalid={!!errors.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />{errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}</div>
        <div className="grid gap-1.5"><Label htmlFor="member-phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="member-phone" type="tel" maxLength={30} placeholder="01XXXXXXXXX" value={form.phone} aria-invalid={!!errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />{errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}</div>
      </form>
      <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" form="member-form" disabled={save.isPending}>{save.isPending ? "Saving…" : member?.id ? "Save" : "Add member"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

// Merge a placeholder into the account the person signed up with. Irreversible, so the dialog spells out what moves.
function MergeDialog({ placeholder, targets, onClose, onMerged }: { placeholder: StaffUser | null; targets: StaffUser[]; onClose: () => void; onMerged: () => void }) {
  const [targetId, setTargetId] = useState("");
  const target = targets.find((t) => t.id === targetId);
  const merge = useMutation({
    mutationFn: () => { if (!placeholder || !targetId) throw new Error("Choose the account to merge into"); return mergePlaceholderPlayer(placeholder.id, targetId); },
    onSuccess: () => { toast.success(`${placeholder?.full_name ?? "Member"} merged into ${target?.full_name ?? "the account"}`); onMerged(); onClose(); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not merge"),
  });
  const name = placeholder?.full_name ?? "this member";
  return <Dialog open={!!placeholder} onOpenChange={(o) => { if (!o && !merge.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">Merge into account</DialogTitle><DialogDescription>Everything recorded for {name} moves to the account you choose: games on team sheets, charges, payments and balance. The account keeps its own name. {name} is then removed. This cannot be undone.</DialogDescription></DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="merge-target">Signed-up account</Label>
        <Select value={targetId} onValueChange={setTargetId}><SelectTrigger id="merge-target" className="w-full"><SelectValue placeholder="Choose the account" /></SelectTrigger><SelectContent>{targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? "Player"}{t.email ? ` · ${t.email}` : ""}</SelectItem>)}</SelectContent></Select>
        {!targets.length && <p className="text-xs text-muted-foreground">No approved accounts to merge into yet. Approve the player's account first.</p>}
      </div>
      <DialogFooter><Button variant="ghost" disabled={merge.isPending} onClick={onClose}>Cancel</Button><Button disabled={!targetId || merge.isPending} onClick={() => merge.mutate()}><Merge />{merge.isPending ? "Merging…" : "Merge"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
