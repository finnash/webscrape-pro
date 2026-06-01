import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { planBySlug } from "@/lib/plans";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { LogOut, ShieldCheck, Zap, ArrowRight, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { profile, isAdmin, refresh } = useProfile();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(profile?.display_name ?? ""); }, [profile?.display_name]);

  const plan = planBySlug(profile?.plan ?? "free");
  const used = (profile?.daily_credit_limit ?? 0) - (profile?.credits_remaining ?? 0);
  const pct = profile?.daily_credit_limit ? Math.min(100, (used / profile.daily_credit_limit) * 100) : 0;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Profile updated"); refresh(); }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UserIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Your Profile</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {isAdmin && (
              <Link to="/admin"><Button variant="outline" size="sm"><ShieldCheck className="h-4 w-4 mr-1.5" /> Admin</Button></Link>
            )}
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" /> Sign out</Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold">Account</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} placeholder="How should we call you?" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="bg-gradient-fire text-primary-foreground">Save changes</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold">Current plan</h2>
                <Badge variant="secondary" className="uppercase text-[10px]">{plan.name}</Badge>
                {isAdmin && <Badge className="bg-primary text-primary-foreground text-[10px]">Admin</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            <Link to="/settings"><Button variant="outline" size="sm">Manage plan <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button></Link>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Daily credits</span>
              <span className="font-medium">
                {profile?.credits_remaining ?? 0} / {profile?.daily_credit_limit ?? 0} left
              </span>
            </div>
            <Progress value={100 - pct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Resets every day at 00:05 UTC.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}