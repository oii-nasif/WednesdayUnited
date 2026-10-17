import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, CalendarDays, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { notificationsQuery, markNotificationsRead } from "@/lib/notifications";
import { fmtDate, fmtTime } from "@/lib/matches";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [], isPending, isError, refetch } = useQuery({ ...notificationsQuery(user?.id ?? ""), enabled: !!user });
  const read = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
    onError: () => toast.error("Could not mark notification as read"),
  });
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notifications-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      qc.invalidateQueries({ queryKey: ["staff-users"] });
      qc.invalidateQueries({ queryKey: ["approval", user.id] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, qc]);
  if (!user) return null;
  const unread = data.filter((n) => !n.read_at).length;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" title="Notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative text-pitch-foreground hover:bg-pitch-foreground/10 hover:text-pitch-foreground"><Bell className="size-5" />{unread > 0 && <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread > 99 ? "99+" : unread}</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-[min(380px,calc(100vw-32px))] p-0">
      <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-2xl">Notifications</h2><Button size="icon" variant="ghost" title="Mark all as read" aria-label="Mark all notifications as read" disabled={!unread || read.isPending} onClick={() => read.mutate(undefined)}><CheckCheck /></Button></div>
      <div className="max-h-[60vh] overflow-y-auto">
        {isPending ? <p className="p-5 text-sm text-muted-foreground">Loading notifications…</p> : isError ? <div className="p-5 text-sm"><p>Could not load notifications.</p><Button variant="link" onClick={() => refetch()}>Retry</Button></div> : !data.length ? <p className="p-5 text-sm text-muted-foreground">No notifications yet.</p> : data.map((n) => {
          const content = <><span className="mt-1 text-primary">{n.kind === "match_published" ? <CalendarDays className="size-4" /> : <UserCheck className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{n.title}</span><span className="mt-1 block text-xs text-muted-foreground">{n.body}</span><span className="mt-2 block text-[10px] text-muted-foreground">{fmtDate(n.created_at)}, {fmtTime(n.created_at)}</span></span>{!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}</>;
          const className = cn("flex gap-3 border-b p-4 last:border-b-0 hover:bg-muted", !n.read_at && "bg-primary-soft/40");
          const click = () => { if (!n.read_at) read.mutate(n.id); setOpen(false); };
          return n.match_id ? <Link key={n.id} to="/matches/$id" params={{ id: n.match_id }} className={className} onClick={click}>{content}</Link> : n.kind === "approval_pending" && isStaff ? <Link key={n.id} to="/users" className={className} onClick={click}>{content}</Link> : <Button key={n.id} variant="ghost" className={cn(className, "h-auto w-full justify-start whitespace-normal rounded-none text-left")} onClick={click}>{content}</Button>;
        })}
      </div>
    </PopoverContent>
  </Popover>;
}