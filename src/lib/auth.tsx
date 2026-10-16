import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "player" | "moderator" | "super_admin";

type AuthState = {
  user: User | null;
  roles: Role[];
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  roles: [],
  loading: true,
  isStaff: false,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (u: User | null) => {
      setUser(u);
      if (u) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
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
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("super_admin");
  const isStaff = isAdmin || roles.includes("moderator");
  return (
    <AuthContext.Provider value={{ user, roles, loading, isStaff, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
