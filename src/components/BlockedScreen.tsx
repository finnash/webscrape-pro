import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ShieldAlert } from "lucide-react";

export const BlockedScreen = () => {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const until = profile?.blocked_until ? new Date(profile.blocked_until) : null;
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6"><Logo size={36} /></div>
        <div className="rounded-2xl border border-destructive/40 bg-card p-8 shadow-elegant">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive mx-auto mb-4 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Account suspended</h1>
          <p className="text-sm text-muted-foreground mb-1">
            {profile?.block_reason || "This account has been blocked by an administrator."}
          </p>
          {until && (
            <p className="text-xs text-muted-foreground mb-4">
              Suspended until {until.toLocaleString()}
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-6">
            Please reach customer support to restore access.
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">Sign out</Button>
        </div>
      </div>
    </div>
  );
};