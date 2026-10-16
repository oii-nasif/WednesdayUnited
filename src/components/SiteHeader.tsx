import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/wu-logo.png.asset.json";
import { CalendarDays, History, Users, Wallet, Settings2, LogOut, ArrowUpRight } from "lucide-react";

export function SiteHeader() {
  const { user, isStaff, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
  const link = "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent py-3 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors";
  const active = { className: "text-primary border-primary" };
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 text-foreground backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src={logo.url} alt="Wednesday United logo" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          <span className="font-display text-xl leading-none sm:text-2xl">Wednesday<br />United</span>
        </Link>
        <nav className="hidden items-center gap-5 lg:flex">
          <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}><CalendarDays className="size-3.5" />Matches</Link>
          <Link to="/history" className={link} activeProps={active}><History className="size-3.5" />History</Link>
          {user && <Link to="/dashboard" className={link} activeProps={active}><Users className="size-3.5" />My games</Link>}
          {user && <Link to="/payments" className={link} activeProps={active}><Wallet className="size-3.5" />Payments</Link>}
          {isStaff && <Link to="/manage" className={link} activeProps={active}><Settings2 className="size-3.5" />Manage</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden max-w-36 truncate text-xs text-muted-foreground sm:inline">
                {user.user_metadata?.['full_name'] ?? "Player"}
              </span>
              <Button size="icon" variant="ghost" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut /></Button>
            </>
          ) : (
            <Button size="sm" variant="accent" asChild>
              <Link to="/auth">Sign in<ArrowUpRight /></Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto px-4 lg:hidden">
        <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}>Matches</Link>
        <Link to="/history" className={link} activeProps={active}>History</Link>
        {user && <Link to="/dashboard" className={link} activeProps={active}>My games</Link>}
        {user && <Link to="/payments" className={link} activeProps={active}>Payments</Link>}
        {isStaff && <Link to="/manage" className={link} activeProps={active}>Manage</Link>}
      </nav>
    </header>
  );
}
