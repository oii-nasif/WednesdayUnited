import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export function AddVenueDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !address.trim()) throw new Error("Venue name and address are required");
      if (mapsUrl.trim()) {
        const link = new URL(mapsUrl.trim());
        if (link.protocol !== "https:" || !(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com"].includes(link.hostname))) throw new Error("Enter a valid Google Maps link");
      }
      const { data, error } = await supabase.from("locations").insert({ name: name.trim(), address: address.trim(), area: area.trim() || null, maps_url: mapsUrl.trim() || null }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Venue added");
      onSaved(id);
      onOpenChange(false);
      setName(""); setAddress(""); setArea(""); setMapsUrl("");
    },
    onError: (error) => toast.error(error.message),
  });
  return <Dialog open={open} onOpenChange={(next) => { if (!save.isPending) onOpenChange(next); }}>
    <DialogContent>
      <DialogHeader><DialogTitle className="font-display text-3xl">Add venue</DialogTitle><DialogDescription>Venue details</DialogDescription></DialogHeader>
      <form id="venue-form" className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-1.5"><Label htmlFor="venue-name">Venue name</Label><Input id="venue-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-address">Street address</Label><Input id="venue-address" required maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-area">Area</Label><Input id="venue-area" maxLength={100} value={area} onChange={(e) => setArea(e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="venue-map">Google Maps link (optional)</Label><Input id="venue-map" type="url" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} /></div>
      </form>
      <DialogFooter><Button variant="ghost" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="venue-form" variant="accent" disabled={save.isPending}>{save.isPending ? "Saving…" : "Add venue"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}