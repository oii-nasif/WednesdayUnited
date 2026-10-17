import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

type Venue = { name: string; address: string | null; area: string | null; maps_url: string | null };

export function VenueMap({ venue }: { venue: Venue }) {
  const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
  const query = [venue.name, venue.address, venue.area, "Bangladesh"].filter(Boolean).join(", ");
  const url = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key ?? "")}&q=${encodeURIComponent(query)}`;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <section className="mt-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Getting there</p>
      <h2 className="mt-1 text-4xl leading-none md:text-5xl">Venue</h2>
      <div className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><MapPin className="size-5" /></span>
            <div className="min-w-0">
              <p className="font-display text-2xl leading-none">{venue.name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{[venue.address, venue.area].filter(Boolean).join(", ") || "Address to be confirmed"}</p>
            </div>
          </div>
          <Button variant="outline" asChild><a href={directions} target="_blank" rel="noreferrer"><Navigation />Directions</a></Button>
        </div>
        {key ? <iframe title={`Google Maps — ${venue.name}`} src={url} className="h-80 w-full border-t" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <p className="border-t p-6 text-sm text-muted-foreground">Google Maps is not configured yet.</p>}
      </div>
    </section>
  );
}
