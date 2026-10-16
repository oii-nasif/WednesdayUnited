import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/wu-logo.png.asset.json";

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
  const link = "text-sm font-medium text-pitch-foreground/80 hover:text-accent transition-colors";
  const active = { className: "text-accent" };
  return (
    <header className="sticky top-0 z-40 bg-pitch text-pitch-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo.url} alt="Wednesday United logo" width={40} height={40} className="h-10 w-10" />
          <span className="font-display text-2xl tracking-wide">Wednesday United</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}>Matches</Link>
          <Link to="/history" className={link} activeProps={active}>History</Link>
          {user && <Link to="/dashboard" className={link} activeProps={active}>My games</Link>}
          {isStaff && <Link to="/manage" className={link} activeProps={active}>Manage</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <span className="hidden text-sm text-pitch-foreground/70 sm:inline">
                {user.user_metadata?.['full_name'] ?? user.email}
              </span>
              <Button size="sm" variant="secondary" onClick={signOut}>Sign out</Button>
            </>
          ) : (
            <Button size="sm" variant="accent" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto px-4 pb-3 md:hidden">
        <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}>Matches</Link>
        <Link to="/history" className={link} activeProps={active}>History</Link>
        {user && <Link to="/dashboard" className={link} activeProps={active}>My games</Link>}
        {isStaff && <Link to="/manage" className={link} activeProps={active}>Manage</Link>}
      </nav>
    </header>
  );
}
