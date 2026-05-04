import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Monitor, RefreshCw, Clock, Zap, Activity, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

type Job = {
  id: string;
  endpoint: string;
  input_url: string | null;
  input_query: string | null;
  status: string;
  credits_used: number | null;
  created_at: string;
  updated_at: string;
};

const CREDITS_PER_BROWSER_MIN = 1; // working assumption: ~1 credit / minute of browser session

export default function BrowserSessions() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("id, endpoint, input_url, input_query, status, credits_used, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setJobs(data || []);
  };

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime: keep the live spinner view in sync as new jobs start / finish.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("browser-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const running = useMemo(() => (jobs || []).filter((j) => j.status === "running" || j.status === "pending"), [jobs]);
  const recent = useMemo(() => (jobs || []).filter((j) => j.status !== "running" && j.status !== "pending").slice(0, 12), [jobs]);

  const totalCreditsToday = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    return (jobs || []).filter((j) => new Date(j.created_at).getTime() > since).reduce((s, j) => s + (j.credits_used || 0), 0);
  }, [jobs]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Monitor className="h-6 w-6 text-primary" /> Browser Sessions
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Live view of every browser the platform is spinning up for you. Watch jobs, costs and runtime in real time.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <StatCard icon={Activity} label="Active sessions" value={String(running.length)} accent={running.length > 0} />
          <StatCard icon={Clock} label="Last 24h jobs" value={String((jobs || []).filter((j) => Date.now() - new Date(j.created_at).getTime() < 86400000).length)} />
          <StatCard icon={Zap} label="Credits used (24h)" value={String(totalCreditsToday)} />
        </div>

        {jobs === null && <SkeletonList />}

        {jobs && (
          <>
            <SectionHeader title="Live now" count={running.length} />
            {running.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {running.map((j) => <LiveBrowserCard key={j.id} job={j} now={now} />)}
              </div>
            )}

            <SectionHeader title="Recent sessions" count={recent.length} />
            {recent.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                No completed sessions yet. <Link to="/scrape" className="text-primary hover:underline">Run a scrape</Link> to spin one up.
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {recent.map((j, i) => <RecentRow key={j.id} job={j} last={i === recent.length - 1} />)}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>
                Browser sessions are billed by runtime — roughly <strong className="text-foreground">~{CREDITS_PER_BROWSER_MIN} credit / minute</strong> for a sustained
                session. A 30-minute task ≈ 30 credits, a 1-hour task ≈ 60. Quick scrapes (under a few seconds) are billed flat per request.
              </span>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

const StatCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-xl border bg-card p-4 ${accent ? "border-primary/50 shadow-glow" : "border-border"}`}>
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
      <Icon className={`h-3.5 w-3.5 ${accent ? "text-primary" : ""}`} /> {label}
    </div>
    <div className="text-2xl font-semibold tracking-tight">{value}</div>
  </div>
);

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <div className="flex items-center gap-2 mb-3">
    <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</h2>
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
  </div>
);

const fmtElapsed = (start: string, now: number) => {
  const ms = Math.max(0, now - new Date(start).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const fmtDuration = (a: string, b: string) => {
  const ms = Math.max(0, new Date(b).getTime() - new Date(a).getTime());
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
};

const LiveBrowserCard = ({ job, now }: { job: Job; now: number }) => {
  const target = job.input_url || job.input_query || "(no input)";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-glow">
      <div className="absolute inset-0 bg-gradient-hero opacity-60 pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Live · {job.endpoint}</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{fmtElapsed(job.created_at, now)}</span>
        </div>

        <div className="rounded-lg border border-border bg-background/80 backdrop-blur px-3 py-2 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Target</div>
          <div className="text-sm font-mono truncate">{target}</div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-fire animate-[shimmer_1.5s_infinite]" style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
            }} />
          </div>
          <span className="text-[10px] text-muted-foreground">working…</span>
        </div>
      </div>
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
};

const RecentRow = ({ job, last }: { job: Job; last: boolean }) => {
  const target = job.input_url || job.input_query || "—";
  const ok = job.status === "completed";
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-border"}`}>
      <div className={`h-2 w-2 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
      <div className="text-xs uppercase tracking-wider w-16 text-muted-foreground shrink-0">{job.endpoint}</div>
      <div className="flex-1 truncate text-sm font-mono">{target}</div>
      <div className="hidden sm:block text-xs text-muted-foreground w-20 text-right">{fmtDuration(job.created_at, job.updated_at)}</div>
      <div className="text-xs text-muted-foreground w-16 text-right">{job.credits_used ?? 0} cr</div>
    </div>
  );
};

const SkeletonList = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card p-8 mb-8 text-center">
    <Monitor className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
    <div className="text-sm font-medium">No active browsers</div>
    <div className="text-xs text-muted-foreground mt-1">Start a scrape or search and watch it appear here in real time.</div>
  </div>
);