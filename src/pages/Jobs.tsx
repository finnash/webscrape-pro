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
import { Globe, ListChecks, Download, Copy, ExternalLink, RotateCw, X, Check, Loader2, AlertCircle, Clock, ChevronRight } from "lucide-react";
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

  const steps = useMemo(() => buildSteps(job), [job]);
  const pct = progressPct(job, steps);
  const meta = r?.metadata || (Array.isArray(r) ? null : r?.data?.metadata) || null;
  const stats = computeStats(job, r, links, md);

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Badge variant="secondary" className="uppercase text-[10px]">{job.endpoint}</Badge>
            <span className="truncate font-mono text-xs text-muted-foreground">{job.input_url || job.input_query}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                {job.status}
              </Badge>
              <span className="text-muted-foreground">
                {formatDistanceStrict(new Date(job.created_at), new Date(job.updated_at || job.created_at))} elapsed
              </span>
            </div>
            <span className="text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} className={job.status === "failed" ? "[&>div]:bg-destructive" : ""} />
        </div>

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

        <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Steps</div>
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <StepRow key={i} step={s} />
            ))}
          </ol>
          {stats.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                  <div className="text-xs font-medium truncate" title={String(s.value)}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-auto flex-1 rounded-lg border border-border bg-muted/30 p-4">
          {job.error ? (
            <div className="text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{job.error}</span>
            </div>
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

type StepState = "done" | "active" | "pending" | "error";
type Step = { label: string; state: StepState; at?: string; detail?: string; context?: Record<string, any> };

const StepIcon = ({ state }: { state: StepState }) => {
  const cls = "h-3.5 w-3.5 mt-0.5 shrink-0";
  if (state === "done") return <Check className={`${cls} text-primary`} />;
  if (state === "active") return <Loader2 className={`${cls} text-primary animate-spin`} />;
  if (state === "error") return <AlertCircle className={`${cls} text-destructive`} />;
  return <Clock className={`${cls} text-muted-foreground`} />;
};

const StepRow = ({ step }: { step: Step }) => {
  const [open, setOpen] = useState(false);
  const hasContext = !!step.context && Object.keys(step.context).length > 0;
  return (
    <li className="text-xs">
      <button
        type="button"
        onClick={() => hasContext && setOpen((v) => !v)}
        className={`w-full flex items-start gap-2 text-left rounded px-1 py-1 ${hasContext ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
      >
        <StepIcon state={step.state} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-1 ${step.state === "pending" ? "text-muted-foreground" : ""}`}>
              {hasContext && (
                <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""} text-muted-foreground`} />
              )}
              {step.label}
            </span>
            {step.at && <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{new Date(step.at).toLocaleTimeString()}</span>}
          </div>
          {step.detail && <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{step.detail}</div>}
        </div>
      </button>
      {open && hasContext && (
        <div className="ml-6 mt-1 mb-2 space-y-2">
          {Object.entries(step.context!).map(([k, v]) => (
            <div key={k} className="rounded border border-border bg-muted/40">
              <div className="flex items-center justify-between px-2 py-1 border-b border-border">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(typeof v === "string" ? v : JSON.stringify(v, null, 2)); toast.success("Copied"); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Copy className="h-2.5 w-2.5" /> Copy
                </button>
              </div>
              <pre className="text-[11px] font-mono p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

function buildSteps(job: any): Step[] {
  const r = job.result || {};
  const ep = job.endpoint;
  const status: string = job.status;
  const created = job.created_at;
  const updated = job.updated_at;
  const failed = status === "failed";
  const cancelled = status === "cancelled";
  const done = status === "completed";
  const running = status === "running" || status === "pending";

  const verb = ep === "search" ? "Searching" : ep === "map" ? "Mapping" : ep === "crawl" ? "Crawling" : "Scraping";
  const itemCount = Array.isArray(r) ? r.length : Array.isArray(r?.data) ? r.data.length : Array.isArray(r?.links) ? r.links.length : null;
  const mdLen = (r?.markdown || r?.summary || "").length;
  const linksArr: string[] = Array.isArray(r?.links) ? r.links : Array.isArray(r) ? r.map((x: any) => x.url).filter(Boolean) : [];
  const meta = r?.metadata || r?.data?.metadata || null;

  const steps: Step[] = [
    {
      label: "Job queued",
      state: "done",
      at: created,
      context: {
        request: { endpoint: ep, input_url: job.input_url, input_query: job.input_query, formats: job.formats, options: job.options },
        job_id: job.id,
      },
    },
    {
      label: `${verb} started`,
      state: running || done || failed ? (running ? "active" : "done") : "pending",
      at: running || done || failed ? created : undefined,
      detail: job.input_url || job.input_query || undefined,
      context: { target: job.input_url || job.input_query, endpoint: ep, options: job.options || {} },
    },
  ];

  if (ep === "scrape") {
    steps.push({
      label: "Fetching page",
      state: done ? "done" : failed ? "error" : running ? "active" : "pending",
      detail: meta?.statusCode ? `HTTP ${meta.statusCode}` : undefined,
      context: meta ? { response_metadata: meta } : undefined,
    });
    steps.push({
      label: "Extracting content",
      state: done ? "done" : failed ? "error" : "pending",
      detail: done && mdLen ? `${mdLen.toLocaleString()} chars of markdown` : undefined,
      context: done ? {
        markdown_preview: (r?.markdown || r?.summary || "").slice(0, 2000),
        markdown_length: mdLen,
        html_length: (r?.html || "").length || undefined,
        formats_returned: r ? Object.keys(r).filter((k) => ["markdown","html","links","screenshot","summary","metadata"].includes(k)) : undefined,
      } : undefined,
    });
  } else if (ep === "search") {
    steps.push({
      label: "Querying index",
      state: done ? "done" : failed ? "error" : running ? "active" : "pending",
      detail: done && itemCount != null ? `${itemCount} results` : undefined,
      context: done ? {
        query: job.input_query,
        results_preview: (Array.isArray(r) ? r : r?.data || []).slice(0, 10),
        total_results: itemCount,
      } : undefined,
    });
  } else if (ep === "map" || ep === "crawl") {
    steps.push({
      label: ep === "map" ? "Discovering URLs" : "Crawling pages",
      state: done ? "done" : failed ? "error" : running ? "active" : "pending",
      detail: done && itemCount != null ? `${itemCount} URLs` : undefined,
      context: done ? {
        urls_preview: linksArr.slice(0, 50),
        total_urls: linksArr.length || itemCount,
      } : undefined,
    });
  }

  if (cancelled) {
    steps.push({ label: "Cancelled by user", state: "error", at: updated, context: { reason: job.error || "Cancelled by user" } });
  } else if (failed) {
    steps.push({ label: "Failed", state: "error", at: updated, detail: job.error || undefined, context: { error: job.error, partial_result: r } });
  } else if (done) {
    steps.push({ label: "Completed", state: "done", at: updated, context: { credits_used: job.credits_used, full_response: r } });
  } else {
    steps.push({ label: "Finalizing", state: "pending" });
  }
  return steps;
}

function progressPct(job: any, steps: Step[]): number {
  if (job.status === "completed") return 100;
  if (job.status === "failed" || job.status === "cancelled") {
    const reached = steps.filter((s) => s.state === "done").length;
    return Math.min(95, Math.round((reached / steps.length) * 100));
  }
  const done = steps.filter((s) => s.state === "done").length;
  const active = steps.some((s) => s.state === "active") ? 0.5 : 0;
  return Math.max(5, Math.min(90, Math.round(((done + active) / steps.length) * 100)));
}

function computeStats(job: any, r: any, links: string[], md: string) {
  const out: { label: string; value: string }[] = [];
  if (job.credits_used != null) out.push({ label: "Credits", value: String(job.credits_used) });
  if (md) out.push({ label: "Markdown", value: `${md.length.toLocaleString()} chars` });
  if (links.length) out.push({ label: "Links", value: String(links.length) });
  const sc = r?.metadata?.statusCode;
  if (sc) out.push({ label: "HTTP", value: String(sc) });
  const title = r?.metadata?.title;
  if (title) out.push({ label: "Title", value: String(title) });
  if (Array.isArray(job.formats) && job.formats.length) out.push({ label: "Formats", value: job.formats.join(", ") });
  return out;
}