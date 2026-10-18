import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "player" | "moderator" | "super_admin";

type AuthState = {
  user: User | null;
  // Effective roles: just "player" while a staff member is in player view.
  roles: Role[];
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  // The account really is staff, whatever the current view.
  staffAccount: boolean;
  playerView: boolean;
  setPlayerView: (on: boolean) => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  roles: [],
  loading: true,
  isStaff: false,
  isAdmin: false,
  staffAccount: false,
  playerView: false,
  setPlayerView: () => {},
});

const PLAYER_VIEW_KEY = "wu-player-view";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation = 0;
    const load = async (u: User | null) => {
      const request = ++generation;
      setUser(u);
      setRoles([]);
      setLoading(true);
      if (u) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
        if (request !== generation) return;
        setRoles((data ?? []).map((r) => r.role as Role));
      } else {
        setRoles([]);
      }
      setLoading(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => load(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => { generation++; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (active && !error) setRoles((data ?? []).map((r) => r.role));
    };
    const channel = supabase.channel(`roles-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, refresh).subscribe();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [user?.id]);

  // Player view only changes what the UI shows and offers. RLS still sees a staff account.
  const [playerView, setPlayerViewState] = useState(false);
  useEffect(() => { setPlayerViewState(localStorage.getItem(PLAYER_VIEW_KEY) === "1"); }, []);
  const setPlayerView = (on: boolean) => {
    setPlayerViewState(on);
    if (on) localStorage.setItem(PLAYER_VIEW_KEY, "1");
    else localStorage.removeItem(PLAYER_VIEW_KEY);
  };

  const staffAccount = roles.includes("super_admin") || roles.includes("moderator");
  const viewingAsPlayer = staffAccount && playerView;
  const effectiveRoles: Role[] = viewingAsPlayer ? ["player"] : roles;
  const isAdmin = effectiveRoles.includes("super_admin");
  const isStaff = isAdmin || effectiveRoles.includes("moderator");
  return (
    <AuthContext.Provider value={{ user, roles: effectiveRoles, loading, isStaff, isAdmin, staffAccount, playerView: viewingAsPlayer, setPlayerView }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
