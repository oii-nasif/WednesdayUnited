import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtTime, participantCount, guestCount } from "@/lib/matches";

type Props = {
  match: {
    id: string;
    title: string;
    starts_at: string;
    status: string;
    player_limit: number | null;
    location: { name: string; area: string | null } | null;
    registrations: { guest_count: number }[];
  };
};

export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "accent"> = {
  published: "accent",
  draft: "secondary",
  completed: "default",
  cancelled: "destructive",
};

export function MatchCard({ match }: Props) {
  const total = participantCount(match.registrations);
  return (
    <Link
      to="/matches/$id"
      params={{ id: match.id }}
      className="group relative block overflow-hidden rounded-xl border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-accent"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary transition group-hover:bg-accent" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl leading-none">{match.title}</h3>
        <Badge variant={statusVariant[match.status]} className="capitalize">{match.status}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{fmtDate(match.starts_at)}</span>
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{fmtTime(match.starts_at)}</span>
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />
          {match.location ? `${match.location.name}${match.location.area ? `, ${match.location.area}` : ""}` : "TBA"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-sm">
        <Users className="h-4 w-4 text-accent" />
        <span className="font-semibold">{total}{match.player_limit ? ` / ${match.player_limit}` : ""}</span>
        <span className="text-muted-foreground">
          participants · {match.registrations.length} players, {guestCount(match.registrations)} guests
        </span>
      </div>
    </Link>
  );
}
