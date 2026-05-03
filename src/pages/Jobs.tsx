import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Globe, ListChecks } from "lucide-react";

export default function Jobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows(data || []));
  }, [user]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <ListChecks className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Jobs</h1>
        </div>

        {!rows && (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        )}
        {rows && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">No jobs yet</div>
            <div className="text-sm text-muted-foreground mt-1">Run your first scrape from the home page.</div>
          </div>
        )}
        {rows && rows.length > 0 && (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {rows.map((j) => (
              <div key={j.id} className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-4 hover:bg-muted/30 transition">
                <div className="h-9 w-9 rounded-lg bg-gradient-fire/10 flex items-center justify-center text-primary shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{j.input_url || j.input_query || j.endpoint}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {j.endpoint} · {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })} · {j.credits_used || 0} credits
                  </div>
                </div>
                <Badge variant={j.status === "completed" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>
                  {j.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}