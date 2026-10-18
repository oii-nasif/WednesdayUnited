import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { POSITIONS, myProfileQuery, updateMyPosition, type Position } from "@/lib/profile";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "My Profile — Wednesday United" },
    { name: "description", content: "Your Wednesday United player profile and preferred position." },
    { property: "og:title", content: "My Profile — Wednesday United" },
    { property: "og:description", content: "Your player profile and preferred position." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProfilePage,
});

const approvalLabel: Record<string, string> = { approved: "Approved", pending: "Waiting for approval", rejected: "Not approved" };

function ProfilePage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const { data: profile, isPending, isError, refetch } = useQuery({ ...myProfileQuery(user?.id ?? ""), enabled: !!user });
  const [choice, setChoice] = useState<Position | null | undefined>(undefined);
  const selected = choice === undefined ? profile?.position ?? null : choice;
  const save = useMutation({
    mutationFn: () => updateMyPosition(user!.id, selected),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["my-profile", user?.id] }); setChoice(undefined); toast.success("Position saved"); },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Could not save your position"),
  });
  const role = roles.includes("super_admin") ? "Super admin" : roles.includes("moderator") ? "Moderator" : "Player";
  const name = profile?.full_name ?? "Player";

  return (
    <div className="page-enter">
      <PageHeader kicker="Player profile" title={<>My <span className="text-accent">profile</span></>}>
        Tell the squad where you like to play.
      </PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {isPending ? <p className="text-muted-foreground">Loading your profile…</p> : isError || !profile ? (
          <div role="alert" className="space-y-3"><p>Could not load your profile.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
        ) : (
          <div className="space-y-8">
            <section className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-6 shadow-card">
              <Avatar className="size-20 ring-4 ring-primary-soft"><AvatarImage src={profile.avatar_url ?? undefined} alt="" /><AvatarFallback className="bg-primary text-2xl text-primary-foreground">{name.slice(0, 1)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-4xl leading-none">{name}</h2>
                <p className="mt-2 flex items-center gap-2 break-all text-sm text-muted-foreground"><Mail className="size-4 shrink-0" />{profile.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary"><ShieldCheck className="size-3.5" />{role}</Badge>
                  <Badge variant={profile.approval_status === "approved" ? "secondary" : "outline"}>{approvalLabel[profile.approval_status] ?? profile.approval_status}</Badge>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-4xl leading-none">Preferred position</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick the role you're happiest playing. Choose All-rounder if you'll slot in anywhere.</p>
              <div role="radiogroup" aria-label="Preferred position" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {POSITIONS.map((p) => {
                  const active = selected === p.value;
                  return (
                    <button key={p.value} type="button" role="radio" aria-checked={active} onClick={() => setChoice(active ? null : p.value)}
                      className={cn("relative flex flex-col items-center gap-1 rounded-xl border bg-card px-3 py-5 text-center transition-all", active ? "border-primary bg-primary text-primary-foreground shadow-lift" : "hover:border-primary/40 hover:shadow-card")}>
                      {active && <Check className="absolute right-2 top-2 size-4" />}
                      <span className="font-display text-4xl leading-none">{p.value}</span>
                      <span className={cn("text-xs font-semibold", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Button variant="accent" disabled={choice === undefined || choice === profile.position || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save position"}</Button>
                {choice !== undefined && choice !== profile.position && <Button variant="ghost" disabled={save.isPending} onClick={() => setChoice(undefined)}>Discard</Button>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
