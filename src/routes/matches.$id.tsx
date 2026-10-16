import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { matchQuery, fmtDate, fmtTime, participantCount, guestCount, registrationOpen } from "@/lib/matches";
import { statusVariant, statusLabel } from "@/components/MatchCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { paymentsQuery } from "@/lib/payments";
import { money, prepaymentTotal } from "@/lib/payment-rules";

export const Route = createFileRoute("/matches/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Match Details — Wednesday United" },
      { name: "description", content: "Match details, venue and who's playing for Wednesday United." },
      { property: "og:title", content: "Match Details — Wednesday United" },
      { property: "og:description", content: "Match details, venue and who's playing." },
    ],
  }),
  component: MatchDetail,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Something went wrong");

function MatchDetail() {
  const { id } = Route.useParams();
  const { user, isStaff, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { data: m, isLoading } = useQuery(matchQuery(id));
  const [guests, setGuests] = useState(0);
  const { data: payments } = useQuery({ ...paymentsQuery(user?.id ?? ""), enabled: !!user });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["match", id] });
    qc.invalidateQueries({ queryKey: ["matches"] });
  };

  const mine = m?.registrations.find((r) => r.user_id === user?.id);

  const join = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to join this match");
      const { error } = await supabase.from("registrations").insert({ match_id: id, user_id: user.id, guest_count: guests });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("You're in!"); refresh(); },
    onError: (e) => toast.error(errMsg(e).includes("duplicate") ? "You're already registered." : errMsg(e)),
  });
  const updateGuests = useMutation({
    mutationFn: async ({ regId, n }: { regId: string; n: number }) => {
      const { error } = await supabase.from("registrations").update({ guest_count: n }).eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Guests updated"); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const leave = useMutation({
    mutationFn: async (regId: string) => {
      const { error } = await supabase.from("registrations").delete().eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed from match"); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-12"><Skeleton className="h-80 rounded-xl" /></div>;
  if (!m) return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">Match not found.</div>;

  const open = registrationOpen(m);
  const total = participantCount(m.registrations);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/" className="text-sm text-primary hover:text-accent">← All matches</Link>
      <div className="mt-4 overflow-hidden rounded-2xl bg-pitch p-8 text-pitch-foreground shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant[m.status]} >{statusLabel[m.status]}</Badge>
          {m.prepayment_required && <Badge variant="secondary">Prepayment required</Badge>}
        </div>
        <h1 className="mt-3 text-6xl leading-none">{m.title}</h1>
        <div className="mt-6 grid gap-3 text-pitch-foreground/85 sm:grid-cols-2">
          <span className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-accent" />{fmtDate(m.starts_at)}</span>
          <span className="flex items-center gap-2"><Clock className="h-5 w-5 text-accent" />{fmtTime(m.starts_at)}</span>
          <span className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" />
            {m.location ? (
              m.location.maps_url ? <a href={m.location.maps_url} target="_blank" rel="noreferrer" className="underline">{m.location.name}, {m.location.area}</a>
                : `${m.location.name}${m.location.area ? `, ${m.location.area}` : ""}`
            ) : "TBA"}
          </span>
          <span className="flex items-center gap-2"><Users className="h-5 w-5 text-accent" />
            {total}{m.player_limit ? ` / ${m.player_limit}` : ""} participants ({m.registrations.length} players, {guestCount(m.registrations)} guests)
          </span>
        </div>
        {m.description && <p className="mt-6 max-w-2xl text-pitch-foreground/80">{m.description}</p>}
        {m.registration_deadline && (
          <p className="mt-3 text-sm text-pitch-foreground/60">Registration closes {fmtDate(m.registration_deadline)}, {fmtTime(m.registration_deadline)}</p>
        )}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 text-3xl">Who's playing</h2>
          {m.registrations.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No one yet — be the first!</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {m.registrations.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{(r.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{r.profile?.full_name ?? "Player"}</span>
                  {r.guest_count > 0 && <Badge variant="secondary">+{r.guest_count} guest{r.guest_count > 1 ? "s" : ""}</Badge>}
                  {r.added_by_staff && <span className="text-xs text-muted-foreground">added by moderator</span>}
                  {isStaff && (
                    <div className="ml-auto flex items-center gap-2">
                      <Input type="number" min={0} max={20} defaultValue={r.guest_count} className="h-8 w-16"
                        onBlur={(e) => { const n = Number(e.target.value); if (n !== r.guest_count) updateGuests.mutate({ regId: r.id, n }); }} />
                      <Button size="sm" variant="ghost" onClick={() => leave.mutate(r.id)}>Remove</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isStaff && <StaffAdd matchId={id} existing={m.registrations.map((r) => r.user_id)} onDone={refresh} />}
        </section>

        <aside className="h-fit rounded-xl border bg-card p-5 shadow-card">
          <h3 className="text-2xl">Your spot</h3>
          {authLoading ? null : !user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">Sign in to join this match.</p>
              <Button variant="accent" className="w-full" asChild><Link to="/auth">Sign in to join</Link></Button>
            </div>
          ) : mine ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm"><span className="font-semibold text-success">You're registered</span>{mine.guest_count ? ` with ${mine.guest_count} guest(s)` : ""}.</p>
              {open && (
                <>
                  <Label htmlFor="g2">Guests</Label>
                  <div className="flex gap-2">
                    <Input id="g2" type="number" min={0} max={20} defaultValue={mine.guest_count}
                      onChange={(e) => setGuests(Number(e.target.value))} />
                    <Button variant="secondary" onClick={() => updateGuests.mutate({ regId: mine.id, n: guests })}>Save</Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => leave.mutate(mine.id)}>Leave match</Button>
                </>
              )}
              {m.prepayment_required && user && (m.status === "published" || m.status === "completed") && <>
                {(payments ?? []).filter((p) => p.match_id === id).map((p) => <p key={p.id} className="text-sm"><Badge variant={p.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge> {money(Number(p.amount))}{p.review_note && <span className="mt-1 block break-words text-muted-foreground">{p.review_note}</span>}</p>)}
                <PaymentSubmission key={`${id}-${mine.guest_count}`} matchId={id} userId={user.id} requiredAmount={prepaymentTotal(Number(m.prepayment_amount ?? 0), mine.guest_count)} />
                <Button variant="link" className="px-0" asChild><Link to="/payments">Payment history</Link></Button>
              </>}
            </div>
          ) : open ? (
            <div className="mt-3 space-y-3">
              <Label htmlFor="g">Bringing guests?</Label>
              <Input id="g" type="number" min={0} max={20} value={guests} onChange={(e) => setGuests(Math.max(0, Number(e.target.value)))} />
              <p className="text-xs text-muted-foreground">Guest costs are charged to you.</p>
              {m.prepayment_required && (
                <p className="flex gap-2 rounded-md bg-secondary p-3 text-xs text-secondary-foreground">
                  <Wallet className="h-4 w-4 shrink-0" />
                  Prepayment of {money(prepaymentTotal(Number(m.prepayment_amount ?? 0), guests))} required.
                </p>
              )}
              {m.prepayment_required && user && <PaymentSubmission canSubmit={false} key={`joining-${guests}`} matchId={id} userId={user.id} requiredAmount={prepaymentTotal(Number(m.prepayment_amount ?? 0), guests)} />}
              <Button variant="accent" className="w-full" disabled={join.isPending} onClick={() => join.mutate()}>Join match</Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Registration is closed.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function StaffAdd({ matchId, existing, onDone }: { matchId: string; existing: string[]; onDone: () => void }) {
  const [userId, setUserId] = useState<string>("");
  const [guests, setGuests] = useState(0);
  const { data: players } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("registrations").insert({ match_id: matchId, user_id: userId, guest_count: guests, added_by_staff: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Player added"); setUserId(""); setGuests(0); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const available = (players ?? []).filter((p) => !existing.includes(p.id));
  return (
    <div className="mt-4 rounded-xl border border-dashed p-4">
      <p className="mb-2 text-sm font-semibold">Moderator: add a player manually</p>
      <div className="flex flex-wrap gap-2">
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-60"><SelectValue placeholder="Choose player" /></SelectTrigger>
          <SelectContent>
            {available.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" min={0} max={20} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-20" aria-label="Guests" />
        <Button disabled={!userId || add.isPending} onClick={() => add.mutate()}>Add</Button>
      </div>
    </div>
  );
}
