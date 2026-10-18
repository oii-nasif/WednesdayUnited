import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

type Venue = Pick<Tables<"locations">, "id" | "name" | "address" | "area" | "maps_url">;

// Adds a venue, or edits one when `venue` is given. Mount with a `key` per venue so the form resets between venues.
export function VenueDialog({ venue, open, onOpenChange, onSaved }: { venue?: Venue | null; open: boolean; onOpenChange: (open: boolean) => void; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [area, setArea] = useState(venue?.area ?? "");
  const [mapsUrl, setMapsUrl] = useState(venue?.maps_url ?? "");
  const editing = !!venue;
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !address.trim()) throw new Error("Venue name and address are required");
      if (mapsUrl.trim()) {
        const link = new URL(mapsUrl.trim());
        if (link.protocol !== "https:" || !(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com"].includes(link.hostname))) throw new Error("Enter a valid Google Maps link");
      }
      const row = { name: name.trim(), address: address.trim(), area: area.trim() || null, maps_url: mapsUrl.trim() || null };
      if (venue) {
        // RLS denial returns zero rows rather than an error, so check what came back.
        const { data, error } = await supabase.from("locations").update(row).eq("id", venue.id).select("id");
        if (error) throw error;
        if (!data.length) throw new Error("You don't have permission to edit this venue");
        return venue.id;
      }
      const { data, error } = await supabase.from("locations").insert(row).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["locations"] }), qc.invalidateQueries({ queryKey: ["matches"] }), qc.invalidateQueries({ queryKey: ["match"] })]);
      toast.success(editing ? "Venue updated" : "Venue added");
      onSaved?.(id);
      onOpenChange(false);
      if (!editing) { setName(""); setAddress(""); setArea(""); setMapsUrl(""); }
    },
    onError: (error) => toast.error(error.message),
  });
  return <Dialog open={open} onOpenChange={(next) => { if (!save.isPending) onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">{editing ? "Edit venue" : "Add venue"}</DialogTitle><DialogDescription>Venue details</DialogDescription></DialogHeader>
      <form id="venue-form" className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-1.5"><Label htmlFor="venue-name">Venue name</Label><Input id="venue-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-address">Street address</Label><Input id="venue-address" required maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-area">Area</Label><Input id="venue-area" maxLength={100} value={area} onChange={(e) => setArea(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-map">Google Maps link (optional)</Label><Input id="venue-map" type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} /></div>
      </form>
      <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="venue-form" variant="accent" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Add venue"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
