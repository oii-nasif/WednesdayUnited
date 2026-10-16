import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { matchesQuery, locationsQuery, fmtDate, fmtTime, participantCount } from "@/lib/matches";
import { statusVariant, statusLabel } from "@/components/MatchCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/manage")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Match Management — Wednesday United" },
      { name: "description", content: "Create, publish and manage Wednesday United matches." },
      { property: "og:title", content: "Match Management — Wednesday United" },
      { property: "og:description", content: "Create, publish and manage matches." },
    ],
  }),
  component: Manage,
});

// datetime-local values are entered in Dhaka time (UTC+6)
const toIso = (local: string) => (local ? new Date(`${local}:00+06:00`).toISOString() : null);
const toLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 16) : "";

type Form = {
  id?: string;
  title: string;
  starts_at: string;
  location_id: string;
  description: string;
  registration_deadline: string;
  player_limit: string;
  prepayment_required: boolean;
  prepayment_amount: string;
};
const empty: Form = { title: "", starts_at: "", location_id: "", description: "", registration_deadline: "", player_limit: "", prepayment_required: false, prepayment_amount: "" };

function Manage() {
  const { isStaff, loading } = useAuth();
  const qc = useQueryClient();
  const { data: matches } = useQuery({ ...matchesQuery("all"), enabled: isStaff });
  const { data: locations } = useQuery(locationsQuery);
  const [form, setForm] = useState<Form | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["matches"] });

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const row = {
        title: f.title.trim(),
        starts_at: toIso(f.starts_at)!,
        location_id: f.location_id || null,
        description: f.description || null,
        registration_deadline: toIso(f.registration_deadline),
        player_limit: f.player_limit ? Number(f.player_limit) : null,
        prepayment_required: f.prepayment_required,
        prepayment_amount: f.prepayment_required && f.prepayment_amount ? Number(f.prepayment_amount) : null,
      };
      const { error } = f.id
        ? await supabase.from("matches").update({ ...row, updated_at: new Date().toISOString() }).eq("id", f.id)
        : await supabase.from("matches").insert({ ...row, status: "draft" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Match saved"); setForm(null); refresh(); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not save"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "published" | "completed" | "cancelled" | "draft" }) => {
      const { error } = await supabase.from("matches").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); refresh(); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Failed"),
  });

  if (loading) return null;
  if (!isStaff) return <div className="mx-auto max-w-xl px-4 py-20 text-center text-muted-foreground">Only moderators can manage matches.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-5xl">Match management</h1>
        <Button variant="accent" onClick={() => setForm({ ...empty })}>+ New match</Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr><th className="p-3">Match</th><th className="p-3">When</th><th className="p-3">Venue</th><th className="p-3">Players</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {(matches ?? []).map((m) => (
              <tr key={m.id}>
                <td className="p-3 font-medium"><Link to="/matches/$id" params={{ id: m.id }} className="hover:text-accent">{m.title}</Link></td>
                <td className="p-3">{fmtDate(m.starts_at)} · {fmtTime(m.starts_at)}</td>
                <td className="p-3">{m.location?.name ?? "—"}</td>
                <td className="p-3">{participantCount(m.registrations)}{m.player_limit ? `/${m.player_limit}` : ""}</td>
                <td className="p-3"><Badge variant={statusVariant[m.status]} >{statusLabel[m.status]}</Badge></td>
                <td className="space-x-1 whitespace-nowrap p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setForm({
                    id: m.id, title: m.title, starts_at: toLocal(m.starts_at), location_id: m.location_id ?? "",
                    description: m.description ?? "", registration_deadline: toLocal(m.registration_deadline),
                    player_limit: m.player_limit?.toString() ?? "", prepayment_required: m.prepayment_required,
                    prepayment_amount: m.prepayment_amount?.toString() ?? "",
                  })}>Edit</Button>
                  {m.status === "draft" && <Button size="sm" onClick={() => setStatus.mutate({ id: m.id, status: "published" })}>Book</Button>}
                  {m.status === "published" && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: m.id, status: "completed" })}>Mark played</Button>}
                  {(m.status === "draft" || m.status === "published") && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelId(m.id)}>Cancel</Button>}
                </td>
              </tr>
            ))}
            {matches?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No matches yet. Create the first one.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-3xl">{form?.id ? "Edit match" : "New match"}</DialogTitle></DialogHeader>
          {form && (
            <form id="mf" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!form.title || !form.starts_at) { toast.error("Title and start time are required"); return; } save.mutate(form); }}>
              <div className="grid gap-1.5"><Label>Title</Label><Input value={form.title} maxLength={100} placeholder="Match title" onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5"><Label>Start (Dhaka time)</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Registration deadline</Label><Input type="datetime-local" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} /></div>
              </div>
              <div className="grid gap-1.5"><Label>Location</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose venue" /></SelectTrigger>
                  <SelectContent>{(locations ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.area ? `, ${l.area}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5"><Label>Description</Label><Textarea value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Player limit (optional)</Label><Input type="number" min={1} value={form.player_limit} onChange={(e) => setForm({ ...form, player_limit: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Prepayment required</Label>
                <Switch checked={form.prepayment_required} onCheckedChange={(v) => setForm({ ...form, prepayment_required: v })} />
              </div>
              {form.prepayment_required && (
                <div className="grid gap-1.5"><Label>Amount per person (৳)</Label><Input type="number" min={0} value={form.prepayment_amount} onChange={(e) => setForm({ ...form, prepayment_amount: e.target.value })} /></div>
              )}
            </form>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Close</Button>
            <Button type="submit" form="mf" variant="accent" disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this match?</AlertDialogTitle>
            <AlertDialogDescription>Players will see it as cancelled and no expenses will be charged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelId) setStatus.mutate({ id: cancelId, status: "cancelled" }); setCancelId(null); }}>Cancel match</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
