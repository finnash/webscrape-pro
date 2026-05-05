import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { Globe, ListChecks, Download, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Jobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any | null>(null);

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
              <button key={j.id} onClick={() => setOpen(j)} className="w-full text-left px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-4 hover:bg-muted/30 transition">
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
            ))}
          </div>
        )}

        <JobDialog job={open} onClose={() => setOpen(null)} />
      </div>
    </AppShell>
  );
}

const JobDialog = ({ job, onClose }: { job: any | null; onClose: () => void }) => {
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