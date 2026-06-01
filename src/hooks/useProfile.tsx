import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  billing_cycle: string | null;
  credits_remaining: number;
  daily_credit_limit: number;
  last_credit_reset: string;
  blocked_until: string | null;
  block_reason: string | null;
};

type Ctx = {
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};
const C = createContext<Ctx>({ profile: null, isAdmin: false, loading: true, refresh: async () => {} });

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); setIsAdmin(false); setLoading(false); return; }
    setLoading(true);
    const sb: any = supabase;
    const [{ data: p }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    setProfile((p as any) ?? null);
    setIsAdmin(Array.isArray(roles) && roles.some((r: any) => r.role === "admin"));
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // realtime credit refresh when profile changes (e.g. admin updates)
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`profile:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => setProfile(payload.new as any))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return <C.Provider value={{ profile, isAdmin, loading, refresh }}>{children}</C.Provider>;
};

export const useProfile = () => useContext(C);