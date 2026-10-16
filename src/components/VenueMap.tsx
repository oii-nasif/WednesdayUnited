import { MapPin } from "lucide-react";

type Venue = { name: string; address: string | null; area: string | null; maps_url: string | null };

export function VenueMap({ venue }: { venue: Venue }) {
  const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
  const query = [venue.name, venue.address, venue.area, "Bangladesh"].filter(Boolean).join(", ");
  const url = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key ?? "")}&q=${encodeURIComponent(query)}`;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <section className="mt-8 border-t pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl">Venue</h2>
        <a href={directions} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary underline"><MapPin className="h-4 w-4" />Open in Google Maps</a>
      </div>
      <p className="font-semibold">{venue.name}</p>
      <p className="mb-4 text-sm text-muted-foreground">{[venue.address, venue.area].filter(Boolean).join(", ")}</p>
      {key ? <iframe title={`Google Maps — ${venue.name}`} src={url} className="h-80 w-full rounded-md border" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <p className="border p-6 text-muted-foreground">Google Maps is not configured yet.</p>}
    </section>
  );
}