import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, formatDistanceStrict } from "date-fns";
import { Globe, ListChecks, Download, Copy, ExternalLink, RotateCw, X, Check, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const RETRY_ROUTES: Record<string, (j: any) => string> = {
  scrape: (j) => `/scrape?url=${encodeURIComponent(j.input_url || "")}`,
  search: (j) => `/search?q=${encodeURIComponent(j.input_query || "")}`,
  map: (j) => `/map?url=${encodeURIComponent(j.input_url || "")}`,
  crawl: (j) => `/crawl?url=${encodeURIComponent(j.input_url || "")}`,
};

const isActive = (s: string) => s === "running" || s === "pending";
const canRetry = (j: any) => !!RETRY_ROUTES[j.endpoint] && (j.input_url || j.input_query);

export default function Jobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows(data || []));
  }, [user]);

  const cancelJob = async (j: any) => {
    setBusy(j.id);
    const { error } = await supabase
      .from("jobs")
      .update({ status: "cancelled", error: "Cancelled by user" })
      .eq("id", j.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs?.map((r) => (r.id === j.id ? { ...r, status: "cancelled", error: "Cancelled by user" } : r)) || null);
    toast.success("Job cancelled");
  };

  const retryJob = (j: any) => {
    const builder = RETRY_ROUTES[j.endpoint];
    if (!builder) { toast.error(`Retry not supported for ${j.endpoint}`); return; }
    navigate(builder(j));
  };

  // Live updates for the open job (handy when a job is still running)
  useEffect(() => {
    if (!open?.id) return;
    const ch = supabase
      .channel(`job-${open.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${open.id}` },
        (payload) => {
          const next = payload.new as any;
          setOpen((o: any) => (o && o.id === next.id ? { ...o, ...next } : o));
          setRows((rs) => rs?.map((r) => (r.id === next.id ? { ...r, ...next } : r)) || null);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open?.id]);

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
              <div key={j.id} className="px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 hover:bg-muted/30 transition">
                <button onClick={() => setOpen(j)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
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
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {isActive(j.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === j.id}
                      onClick={(e) => { e.stopPropagation(); cancelJob(j); }}
                      title="Cancel job"
                    >
                      <X className="h-3.5 w-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                  )}
                  {(j.status === "failed" || j.status === "cancelled") && canRetry(j) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); retryJob(j); }}
                      title="Retry job"
                    >
                      <RotateCw className="h-3.5 w-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Retry</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <JobDialog
          job={open}
          onClose={() => setOpen(null)}
          onCancel={async (j) => { await cancelJob(j); setOpen({ ...j, status: "cancelled", error: "Cancelled by user" }); }}
          onRetry={(j) => { setOpen(null); retryJob(j); }}
        />
      </div>
    </AppShell>
  );
}

const JobDialog = ({
  job,
  onClose,
  onCancel,
  onRetry,
}: {
  job: any | null;
  onClose: () => void;
  onCancel: (j: any) => void | Promise<void>;
  onRetry: (j: any) => void;
}) => {
  if (!job) return null;
  const r = job.result || {};
  const md = r.markdown || r.summary || "";
  const links: string[] = Array.isArray(r.links) ? r.links : Array.isArray(r) ? r.map((x: any) => x.url).filter(Boolean) : [];
  const dl = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };
  const slug = (job.input_url || job.input_query || job.endpoint).replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Badge variant="secondary" className="uppercase text-[10px]">{job.endpoint}</Badge>
            <span className="truncate font-mono text-xs text-muted-foreground">{job.input_url || job.input_query}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {job.input_url && (
            <Button asChild variant="outline" size="sm"><a href={job.input_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Open URL</a></Button>
          )}
          {isActive(job.status) && (
            <Button variant="outline" size="sm" onClick={() => onCancel(job)}>
              <X className="h-3.5 w-3.5 mr-1.5" />Cancel
            </Button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && canRetry(job) && (
            <Button variant="outline" size="sm" onClick={() => onRetry(job)}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5" />Retry
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => dl(JSON.stringify(job.result, null, 2), `${slug}.json`, "application/json")}>
            <Download className="h-3.5 w-3.5 mr-1.5" />JSON
          </Button>
          {md && <Button variant="outline" size="sm" onClick={() => dl(md, `${slug}.md`, "text/markdown")}><Download className="h-3.5 w-3.5 mr-1.5" />Markdown</Button>}
          {links.length > 0 && <Button variant="outline" size="sm" onClick={() => dl("url\n" + links.join("\n"), `${slug}-links.csv`, "text/csv")}><Download className="h-3.5 w-3.5 mr-1.5" />Links CSV</Button>}
          <Button variant="ghost" size="sm" onClick={() => copy(JSON.stringify(job.result, null, 2))}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
        </div>
        <div className="overflow-auto flex-1 rounded-lg border border-border bg-muted/30 p-4">
          {job.error ? (
            <div className="text-sm text-destructive">{job.error}</div>
          ) : md ? (
            <pre className="text-xs whitespace-pre-wrap font-mono">{md.slice(0, 20000)}</pre>
          ) : (
            <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(job.result, null, 2).slice(0, 20000)}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};