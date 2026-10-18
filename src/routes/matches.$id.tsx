import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useApproval } from "@/lib/approval";
import { canJoinWithApproval } from "@/lib/approval-rules";
import { matchQuery, fmtDate, fmtTime, participantCount, guestCount, registrationOpen, spotsLabel } from "@/lib/matches";
import { statusVariant, statusLabel } from "@/components/MatchCard";
import { PitchLines } from "@/components/PitchLines";
import { Countdown } from "@/components/Countdown";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentSubmission } from "@/components/PaymentSubmission";
import { paymentsQuery } from "@/lib/payments";
import { money, prepaymentTotal } from "@/lib/payment-rules";
import { matchDuesQuery, settlementOf, type MatchDue } from "@/lib/ledger";
import { DueIcon } from "@/components/Balance";
import { VenueMap } from "@/components/VenueMap";
import { BallLoader, Football } from "@/components/Football";
import { GoalCelebration } from "@/components/GoalCelebration";
import { GuestStepper } from "@/components/GuestStepper";
import { PitchLineup } from "@/components/PitchLineup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const approval = useApproval();
  const qc = useQueryClient();
  const { data: m, isLoading } = useQuery(matchQuery(id));
  const [guests, setGuests] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const { data: payments } = useQuery({ ...paymentsQuery(user?.id ?? ""), enabled: !!user });
  const settlement = m ? settlementOf(m) : null;
  // RLS scopes this: players get their own due, staff get everyone's.
  const { data: dues } = useQuery({ ...matchDuesQuery(id), enabled: !!user && !!settlement?.settled_at });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["match", id] });
    qc.invalidateQueries({ queryKey: ["matches"] });
  };

  const mine = m?.registrations.find((r) => r.user_id === user?.id);

  const join = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to join this match");
      if (!canJoinWithApproval(approval.data ?? null, isStaff)) throw new Error("Your account needs squad approval before joining matches.");
      const { error } = await supabase.from("registrations").insert({ match_id: id, user_id: user.id, guest_count: guests });
      if (error) throw error;
    },
    onSuccess: () => { setCelebrating(true); toast.success("You're in!"); refresh(); },
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

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-12"><BallLoader label="Warming up" /></div>;
  if (!m) return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">Match not found.</div>;

  const open = registrationOpen(m);
  const total = participantCount(m.registrations);

  return (
    <div className="page-enter">
      {celebrating && <GoalCelebration subtitle="You're in. See you on the pitch." onDone={() => setCelebrating(false)} />}
      <section className="bg-moonlight relative overflow-hidden text-pitch-foreground">
        <PitchLines className="text-white/[0.06]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 md:pb-14">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pitch-foreground/70 transition-colors hover:text-accent"><ArrowLeft className="size-4" />All matches</Link>
          <div className="mt-6 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div className="rise min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[m.status]}>{statusLabel[m.status]}</Badge>
                {m.prepayment_required && <Badge variant="outline" className="border-white/25 text-pitch-foreground">Prepayment · {money(Number(m.prepayment_amount ?? 0))}</Badge>}
                {spotsLabel(total, m.player_limit) && m.status === "published" && <Badge variant="outline" className="border-accent/60 text-accent">{spotsLabel(total, m.player_limit)}</Badge>}
              </div>
              <h1 className="mt-4 break-words text-6xl leading-[0.88] md:text-8xl">{m.title}</h1>
              {m.description && <p className="mt-4 max-w-2xl text-pitch-foreground/75">{m.description}</p>}
            </div>
            {m.status === "published" && (
              <div className="rise [animation-delay:120ms]">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-pitch-foreground/60">Kick-off in</p>
                <Countdown target={m.starts_at} />
              </div>
            )}
          </div>
          <dl className="rise mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 [animation-delay:200ms] lg:grid-cols-4">
            {[
              { icon: CalendarDays, label: "Date", value: fmtDate(m.starts_at) },
              { icon: Clock, label: "Kick-off", value: fmtTime(m.starts_at) },
              { icon: MapPin, label: "Venue", value: m.location ? (m.location.maps_url ? <a href={m.location.maps_url} target="_blank" rel="noreferrer" className="underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">{m.location.name}</a> : m.location.name) : "TBA", sub: m.location?.area },
              { icon: Users, label: "Squad", value: <>{total}{m.player_limit ? <span className="text-pitch-foreground/50">/{m.player_limit}</span> : ""}</>, sub: `${m.registrations.length} players · ${guestCount(m.registrations)} guests` },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="min-w-0 bg-pitch-deep/70 p-4 backdrop-blur sm:p-5">
                <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-pitch-foreground/55"><Icon className="size-3.5 text-accent" />{label}</dt>
                <dd className="mt-1.5 truncate font-display text-3xl leading-none">{value}</dd>
                {sub && <dd className="mt-1 truncate text-xs text-pitch-foreground/55">{sub}</dd>}
              </div>
            ))}
          </dl>
          {m.registration_deadline && (
            <p className="mt-4 text-sm text-pitch-foreground/60">Registration closes {fmtDate(m.registration_deadline)}, {fmtTime(m.registration_deadline)}</p>
          )}
        </div>
        <div className="h-1 bg-gradient-to-r from-accent via-accent to-primary" />
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <Tabs defaultValue="pitch">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Team sheet</p>
                <h2 className="mt-1 text-4xl leading-none md:text-5xl">Who's playing</h2>
              </div>
              <TabsList><TabsTrigger value="pitch">Pitch</TabsTrigger><TabsTrigger value="list">List</TabsTrigger></TabsList>
            </div>
            {settlement?.settled_at && settlement.total_cost != null && settlement.cost_per_head != null && <SettlementSummary total={settlement.total_cost} perHead={settlement.cost_per_head} dues={isStaff ? dues : undefined} />}
            <TabsContent value="pitch"><PitchLineup players={m.registrations} currentUserId={user?.id} /></TabsContent>
            <TabsContent value="list">
            {m.registrations.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">No one yet — be the first!</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-card">
                {m.registrations.map((r, i) => (
                  <li key={r.id} className={cn("flex items-center gap-3 p-3 transition-colors hover:bg-primary-soft/50", r.user_id === user?.id && "bg-accent-soft")}>
                    <span className="w-6 text-center font-display text-xl text-muted-foreground tabular">{i + 1}</span>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                      <AvatarFallback>{(r.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    {isStaff ? <Link to="/players/$id" params={{ id: r.user_id }} className="font-medium hover:text-primary hover:underline">{r.profile?.full_name ?? "Player"}</Link> : <span className="font-medium">{r.profile?.full_name ?? "Player"}</span>}
                    {r.guest_count > 0 && <Badge variant="secondary">+{r.guest_count} guest{r.guest_count > 1 ? "s" : ""}</Badge>}
                    {r.added_by_staff && <span className="text-xs text-muted-foreground">added by moderator</span>}
                    {isStaff && <DueIcon due={dues?.get(r.user_id)} className="ml-auto" />}
                    {isStaff && !settlement?.settled_at && (
                      <div className="ml-auto flex items-center gap-2">
                        <Input type="number" min={0} max={m.max_guests} defaultValue={r.guest_count} className="h-8 w-16" aria-label={`Guests for ${r.profile?.full_name ?? "player"}`}
                          onBlur={(e) => { const n = Number(e.target.value); if (n !== r.guest_count) updateGuests.mutate({ regId: r.id, n }); }} />
                        <Button size="sm" variant="ghost" onClick={() => leave.mutate(r.id)}>Remove</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            </TabsContent>
          </Tabs>
          {isStaff && <StaffAdd matchId={id} existing={m.registrations.map((r) => r.user_id)} maxGuests={m.max_guests} onDone={refresh} />}
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border bg-card shadow-lift lg:sticky lg:top-24">
          <div className="bg-moonlight relative overflow-hidden px-5 py-4 text-pitch-foreground">
            <PitchLines className="text-white/[0.08]" />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Matchday pass</p>
            <h3 className="relative text-3xl leading-none">{mine ? "You're on the team sheet" : "Your spot"}</h3>
          </div>
          <div className="p-5">
          {authLoading ? null : !user ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">Sign in to join this match.</p>
              <Button variant="accent" className="w-full" asChild><Link to="/auth">Sign in to join</Link></Button>
            </div>
          ) : mine ? (
            <div className="mt-3 space-y-3">
              <p className="flex items-center gap-3 rounded-xl bg-success/10 p-3 text-sm"><Football className="size-8 shrink-0" /><span><span className="font-bold text-success">You're registered</span>{mine.guest_count ? ` with ${mine.guest_count} guest${mine.guest_count > 1 ? "s" : ""}` : ""}. See you on the pitch.</span></p>
              {open && (
                <>
                  <MyGuests key={mine.guest_count} current={mine.guest_count} max={m.max_guests} saving={updateGuests.isPending} onSave={(n) => updateGuests.mutate({ regId: mine.id, n })} />
                  <Button variant="outline" className="w-full" onClick={() => leave.mutate(mine.id)}>Leave match</Button>
                </>
              )}
              {settlement?.settled_at && <MyShare due={dues?.get(mine.user_id)} />}
              {m.prepayment_required && user && (m.status === "published" || m.status === "completed") && <>
                {(payments ?? []).filter((p) => p.match_id === id).map((p) => <p key={p.id} className="text-sm"><Badge variant={p.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge> {money(Number(p.amount))}{p.review_note && <span className="mt-1 block break-words text-muted-foreground">{p.review_note}</span>}</p>)}
                {m.status === "published" && <PaymentSubmission key={`${id}-${mine.guest_count}`} matchId={id} userId={user.id} requiredAmount={prepaymentTotal(Number(m.prepayment_amount ?? 0), mine.guest_count)} />}
                <Button variant="link" className="px-0" asChild><Link to="/payments">Payment history</Link></Button>
              </>}
            </div>
          ) : !isStaff && !canJoinWithApproval(approval.data ?? null, false) ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold">{approval.isPending ? "Checking squad approval…" : approval.isError ? "Unable to check squad approval." : approval.data === "rejected" ? "Your squad approval was declined." : "Awaiting squad approval."}</p>
              <p className="text-muted-foreground">A moderator must approve your account before you can join matches.</p>
              {approval.isError && <Button variant="outline" onClick={() => approval.refetch()}>Retry</Button>}
              {!open && <p className="text-muted-foreground">{m.status === "published" && m.registration_deadline ? `Registration closed on ${fmtDate(m.registration_deadline)}, ${fmtTime(m.registration_deadline)}.` : "Registration is closed for this match."}</p>}
            </div>
          ) : open ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm font-medium">Bringing guests?</p>
              <GuestStepper value={guests} onChange={setGuests} max={m.max_guests} label="Bringing guests?" />
              <p className="text-xs text-muted-foreground">Up to {m.max_guests} guest{m.max_guests === 1 ? "" : "s"} per player. Guest costs are charged to you.</p>
              {m.prepayment_required && (
                <p className="flex gap-2 rounded-md bg-secondary p-3 text-xs text-secondary-foreground">
                  <Wallet className="h-4 w-4 shrink-0" />
                  Prepayment of {money(prepaymentTotal(Number(m.prepayment_amount ?? 0), guests))} required.
                </p>
              )}
              {m.prepayment_required && user && <PaymentSubmission canSubmit={false} key={`joining-${guests}`} matchId={id} userId={user.id} requiredAmount={prepaymentTotal(Number(m.prepayment_amount ?? 0), guests)} />}
              <Button variant="accent" size="lg" className="group w-full" disabled={join.isPending} onClick={() => join.mutate()}>
                <Football className={join.isPending ? "size-5 animate-spin" : "size-5 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[360deg]"} />
                {join.isPending ? "Joining…" : "Join match"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{m.status === "published" && m.registration_deadline ? `Registration closed on ${fmtDate(m.registration_deadline)}, ${fmtTime(m.registration_deadline)}.` : "Registration is closed for this match."}</p>
          )}
          </div>
        </aside>
      </div>
      {m.location && <VenueMap venue={m.location} />}
      </div>
    </div>
  );
}

function MyGuests({ current, max, saving, onSave }: { current: number; max: number; saving: boolean; onSave: (n: number) => void }) {
  const [n, setN] = useState(current);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Guests</p>
      <GuestStepper value={n} onChange={setN} max={Math.max(max, current)} />
      {n !== current && <Button variant="secondary" className="w-full animate-in fade-in" disabled={saving} onClick={() => onSave(n)}>Save guests</Button>}
    </div>
  );
}

function StaffAdd({ matchId, existing, maxGuests: cap, onDone }: { matchId: string; existing: string[]; maxGuests: number; onDone: () => void }) {
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
        <Input type="number" min={0} max={cap} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-20" aria-label="Guests" />
        <Button disabled={!userId || add.isPending} onClick={() => add.mutate()}>Add</Button>
      </div>
    </div>
  );
}

// Shown once a match is settled: what it cost, and for staff how much of it has been paid.
function SettlementSummary({ total, perHead, dues }: { total: number; perHead: number; dues: Map<string, MatchDue> | undefined }) {
  const rows = dues ? [...dues.values()] : [];
  const outstanding = rows.reduce((n, d) => n + d.due, 0);
  const paid = rows.filter((d) => d.due <= 0).length;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card px-5 py-4 text-sm shadow-card">
      <span className="flex items-center gap-2"><Wallet className="size-4 text-primary" />Match cost <strong className="tabular">{money(total)}</strong></span>
      <span><strong className="tabular">{money(perHead)}</strong> per head</span>
      {dues && <>
        <span className="text-success"><strong>{paid}</strong> of {rows.length} paid</span>
        {outstanding > 0 ? <span className="font-semibold text-destructive">{money(outstanding)} outstanding</span> : <span className="font-semibold text-success">Fully paid</span>}
      </>}
    </div>
  );
}

function MyShare({ due }: { due: MatchDue | undefined }) {
  if (!due) return null;
  const paid = due.due <= 0;
  return (
    <div className={cn("rounded-xl border p-3 text-sm", paid ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10")}>
      <p className="flex items-center justify-between gap-3"><span>Your share</span><strong className="tabular">{money(due.charged)}</strong></p>
      {paid ? <p className="mt-1 font-semibold text-success">Paid. Thanks!</p> : <p className="mt-1 font-semibold text-destructive">{money(due.due)} still due. <Link to="/payments" className="underline">Pay now</Link></p>}
    </div>
  );
}
