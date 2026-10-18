import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { locationsQuery } from "@/lib/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmation, type DeleteTarget } from "@/components/DeleteConfirmation";
import { VenueDialog } from "@/components/VenueDialog";

export function VenueManagement({ onAdd }: { onAdd: () => void }) {
  const { data: venues, isLoading, error } = useQuery(locationsQuery);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = venues?.find((v) => v.id === editId) ?? null;
  const visible = (venues ?? []).filter((v) => `${v.name} ${v.area ?? ""} ${v.address ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="mt-6">
    <div className="mb-6 flex flex-wrap gap-3">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search venues" placeholder="Search venues or areas" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Button onClick={onAdd}><Plus />Add venue</Button>
    </div>
    {error ? <p className="text-destructive">Could not load venues.</p> : isLoading ? <p className="text-muted-foreground">Loading venues…</p> : visible.length ?
      <div className="grid gap-4 md:grid-cols-2">{visible.map((v) => <article key={v.id} className="flex items-start gap-4 rounded-lg border bg-card p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><MapPin className="size-5" /></div>
        <div className="min-w-0 flex-1"><h3 className="break-words text-2xl">{v.name}</h3><p className="mt-1 text-xs font-semibold uppercase text-primary">{v.area}</p><p className="mt-2 break-words text-sm text-muted-foreground">{v.address}</p></div>
        <Button size="icon" variant="ghost" className="shrink-0" title={`Edit ${v.name}`} aria-label={`Edit venue ${v.name}`} onClick={() => setEditId(v.id)}><Pencil /></Button>
        <Button size="icon" variant="ghost" className="-ml-3 shrink-0 text-destructive" title={`Delete ${v.name}`} aria-label={`Delete venue ${v.name}`} onClick={() => setTarget({ entity: "venue", id: v.id, name: v.name })}><Trash2 /></Button>
      </article>)}</div> : <div className="border-y py-12 text-center text-muted-foreground">{search ? "No matching venues." : "No venues yet."}</div>}
    <DeleteConfirmation target={target} onClose={() => setTarget(null)} />
    <VenueDialog key={editId ?? "none"} venue={editing} open={!!editing} onOpenChange={(open) => { if (!open) setEditId(null); }} />
  </section>;
}