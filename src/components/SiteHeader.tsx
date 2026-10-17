import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Football } from "@/components/Football";
import { cn } from "@/lib/utils";
import { TeamBadge } from "@/components/TeamBadge";
import { CalendarDays, History, Users, Wallet, Settings2, LogOut, ArrowUpRight, LogIn } from "lucide-react";

type NavItem = { to: "/" | "/history" | "/dashboard" | "/payments" | "/manage" | "/auth"; label: string; icon: ComponentType<{ className?: string }>; active: (path: string) => boolean };

function useNavItems(signedIn: boolean, staff: boolean): NavItem[] {
  return [
    { to: "/", label: "Matches", icon: CalendarDays, active: (p) => p === "/" || p.startsWith("/matches") },
    { to: "/history", label: "History", icon: History, active: (p) => p.startsWith("/history") },
    ...(signedIn
      ? [
          { to: "/dashboard", label: "My games", icon: Users, active: (p: string) => p.startsWith("/dashboard") },
          { to: "/payments", label: "Payments", icon: Wallet, active: (p: string) => p.startsWith("/payments") },
        ] as NavItem[]
      : []),
    ...(staff ? [{ to: "/manage", label: "Manage", icon: Settings2, active: (p: string) => p.startsWith("/manage") }] as NavItem[] : []),
  ];
}

// Tracks the centre of the active nav item so a ball can roll underneath it.
function useRollingBall(activeIndex: number, deps: unknown[]) {
  const nav = useRef<HTMLElement>(null);
  const [x, setX] = useState<number | null>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const measure = () => {
      const item = el.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);
      setX(item ? item.offsetLeft + item.offsetWidth / 2 : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, ...deps]);
  return { nav, x };
}

// Rotation that matches the distance travelled, so the ball visibly rolls instead of sliding.
function RollingBall({ x, size, className }: { x: number | null; size: number; className?: string }) {
  if (x === null) return null;
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute left-0 transition-transform duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]", className)} style={{ transform: `translateX(${x - size / 2}px) rotate(${(x / (Math.PI * size)) * 360}deg)`, width: size, height: size }}>
      <Football className="size-full drop-shadow-[0_2px_3px_rgb(0_0_0/0.45)]" />
    </span>
  );
}

export function SiteHeader() {
  const { user, isStaff, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = useNavItems(!!user, isStaff);
  const activeIndex = items.findIndex((i) => i.active(path));
  const desktop = useRollingBall(activeIndex, [items.length]);
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const name = (user?.user_metadata?.["full_name"] as string | undefined) ?? "Player";
  const avatar = user?.user_metadata?.["avatar_url"] as string | undefined;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-pitch text-pitch-foreground shadow-[0_8px_24px_-12px_oklch(0.15_0.05_264/0.6)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 lg:h-[72px]">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <TeamBadge className="size-9 text-base ring-2 ring-white/15 transition-transform duration-500 group-hover:rotate-[360deg] lg:size-10" />
            <span className="font-display text-[22px] leading-[0.85] tracking-wide">Wednesday<br /><span className="text-accent">United</span></span>
          </Link>
          <nav ref={desktop.nav} className="relative hidden h-full items-center gap-1 lg:flex" aria-label="Main">
            {items.map((item, i) => (
              <Link key={item.to} to={item.to} data-nav-index={i} aria-current={i === activeIndex ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors", i === activeIndex ? "text-pitch-foreground" : "text-pitch-foreground/60 hover:bg-white/5 hover:text-pitch-foreground")}>
                <item.icon className={cn("size-4", i === activeIndex && "text-accent")} />{item.label}
              </Link>
            ))}
            <RollingBall x={desktop.x} size={14} className="-bottom-[7px]" />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {loading ? null : user ? (
              <>
                <span className="hidden items-center gap-2.5 rounded-full bg-white/5 py-1 pl-1 pr-3.5 ring-1 ring-white/10 sm:flex">
                  <Avatar className="size-7"><AvatarImage src={avatar} alt="" /><AvatarFallback className="bg-primary text-xs text-primary-foreground">{name.slice(0, 1)}</AvatarFallback></Avatar>
                  <span className="max-w-32 truncate text-sm font-semibold">{name.split(" ")[0]}</span>
                </span>
                <Button size="icon" variant="ghost" className="text-pitch-foreground/70 hover:bg-white/10 hover:text-pitch-foreground" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut /></Button>
              </>
            ) : (
              <Button size="sm" variant="accent" className="h-9 px-4" asChild>
                <Link to="/auth">Join the squad<ArrowUpRight /></Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <MobileTabBar items={user || loading ? items : [...items, { to: "/auth", label: "Sign in", icon: LogIn, active: (p) => p.startsWith("/auth") }]} path={path} />
    </>
  );
}

// App-style bottom bar for small screens; the ball rolls along its top edge to the active tab.
function MobileTabBar({ items, path }: { items: NavItem[]; path: string }) {
  const activeIndex = items.findIndex((i) => i.active(path));
  const { nav, x } = useRollingBall(activeIndex, [items.length]);
  return (
    <nav ref={nav} aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pitch/95 pb-[env(safe-area-inset-bottom)] text-pitch-foreground backdrop-blur-xl lg:hidden">
      <RollingBall x={x} size={16} className="-top-2" />
      <div className="flex">
        {items.map((item, i) => (
          <Link key={item.to} to={item.to} data-nav-index={i} aria-current={i === activeIndex ? "page" : undefined}
            className={cn("flex flex-1 flex-col items-center gap-1 pb-2.5 pt-3 text-[10px] font-bold uppercase tracking-wider transition-colors", i === activeIndex ? "text-pitch-foreground" : "text-pitch-foreground/50")}>
            <item.icon className={cn("size-5 transition-transform", i === activeIndex && "-translate-y-0.5 text-accent")} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
