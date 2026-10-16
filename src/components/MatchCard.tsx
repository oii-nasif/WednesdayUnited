import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
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

export const statusLabel: Record<string, string> = { published: "Booked", draft: "Draft", completed: "Completed", cancelled: "Cancelled" };

export function MatchCard({ match }: Props) {
  const total = participantCount(match.registrations);
  const date = new Date(match.starts_at);
  return (
    <Link
      to="/matches/$id"
      params={{ id: match.id }}
      className="group relative block overflow-hidden rounded-lg border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-secondary text-primary"><span className="text-[10px] font-semibold uppercase">{date.toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Dhaka" })}</span><span className="font-display text-3xl leading-none">{date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Asia/Dhaka" })}</span></div><div className="min-w-0"><Badge variant={statusVariant[match.status]}>{statusLabel[match.status]}</Badge><h3 className="mt-2 break-words text-2xl leading-none">{match.title}</h3></div></div>
        <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{fmtDate(match.starts_at)} · {fmtTime(match.starts_at)}</span>
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />
          {match.location ? `${match.location.name}${match.location.area ? `, ${match.location.area}` : ""}` : "TBA"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-sm">
        <Users className="h-4 w-4 text-accent" />
        <span className="font-semibold">{total}{match.player_limit ? ` / ${match.player_limit}` : ""}</span>
        <span className="text-muted-foreground">
          playing · {guestCount(match.registrations)} guests
        </span>
      </div>
      {match.player_limit && <progress aria-label="Match capacity" value={total} max={match.player_limit} className="mt-3 h-1.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />}
    </Link>
  );
}
