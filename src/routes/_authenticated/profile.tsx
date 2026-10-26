import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { POSITIONS, myProfileQuery, roleLabel, updateMyPosition, type Position } from "@/lib/profile";
import { removeAvatar, uploadAvatar, validateAvatar } from "@/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarPhoto } from "@/components/AvatarPhoto";
import { PageHeader } from "@/components/PageHeader";
import { ProfileSummary } from "@/components/ProfileSummary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "My Profile â€” Wednesday United" },
    { name: "description", content: "Your Wednesday United player profile and preferred position." },
    { property: "og:title", content: "My Profile â€” Wednesday United" },
    { property: "og:description", content: "Your player profile and preferred position." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProfilePage,
});

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
  const role = roleLabel(roles);

  return (
    <div className="page-enter">
      <PageHeader kicker="Player profile" title={<>My <span className="text-accent">profile</span></>}>
        Your photo and where you like to play.
      </PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {isPending ? <p className="text-muted-foreground">Loading your profileâ€¦</p> : isError || !profile ? (
          <div role="alert" className="space-y-3"><p>Could not load your profile.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
        ) : (
          <div className="space-y-8">
            <ProfileSummary profile={profile} role={role} />

            <PhotoSection userId={user!.id} name={profile.full_name ?? "Player"} avatarUrl={profile.avatar_url} />

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
                <Button variant="accent" disabled={choice === undefined || choice === profile.position || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Savingâ€¦" : "Save position"}</Button>
                {choice !== undefined && choice !== profile.position && <Button variant="ghost" disabled={save.isPending} onClick={() => setChoice(undefined)}>Discard</Button>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// Pick a photo, see it before saving, keep it under 300 KB (the bucket enforces the same limit).
function PhotoSection({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl: string | null }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const choose = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setFile(null); setPreview(null); return; }
    try { validateAvatar(f); } catch (e) { toast.error((e as Error).message); if (input.current) input.current.value = ""; return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const done = async (message: string) => { await qc.invalidateQueries({ queryKey: ["my-profile", userId] }); choose(null); if (input.current) input.current.value = ""; toast.success(message); };
  const upload = useMutation({ mutationFn: () => uploadAvatar(userId, file!), onSuccess: () => done("Photo updated"), onError: (e: Error) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: () => removeAvatar(userId), onSuccess: () => done("Photo removed"), onError: (e: Error) => toast.error(e.message) });
  const busy = upload.isPending || remove.isPending;
  return (
    <section>
      <h2 className="text-4xl leading-none">Profile photo</h2>
      <p className="mt-1 text-sm text-muted-foreground">Shown on team sheets and the squad list. JPG, PNG or WebP, up to 300 KB.</p>
      <div className="mt-5 flex flex-wrap items-center gap-5 rounded-2xl border bg-card p-5">
        <Avatar className="size-24 ring-4 ring-primary-soft">{preview ? <AvatarImage src={preview} alt="" /> : <AvatarPhoto src={avatarUrl} />}<AvatarFallback className="bg-primary text-3xl text-primary-foreground">{name.slice(0, 1)}</AvatarFallback></Avatar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}><Camera />{avatarUrl ? "Choose a new photo" : "Choose a photo"}</Button>
          {file && <Button type="button" variant="accent" disabled={busy} onClick={() => upload.mutate()}>{upload.isPending ? "Uploading…" : "Save photo"}</Button>}
          {file && <Button type="button" variant="ghost" disabled={busy} onClick={() => { choose(null); if (input.current) input.current.value = ""; }}>Discard</Button>}
          {!file && avatarUrl && <Button type="button" variant="ghost" disabled={busy} onClick={() => remove.mutate()}><Trash2 />{remove.isPending ? "Removing…" : "Remove photo"}</Button>}
          {file && <p className="w-full text-xs text-muted-foreground">{file.name} · {Math.ceil(file.size / 1024)} KB</p>}
        </div>
      </div>
    </section>
  );
}
