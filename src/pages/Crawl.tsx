import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Layers, ExternalLink, Download } from "lucide-react";

export default function Crawl() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState(params.get("url") || "");
  const [limit, setLimit] = useState(25);
  const [maxDepth, setMaxDepth] = useState(2);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);

  const start = async () => {
    if (!url.trim()) return toast.error("Enter a URL");
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    setLoading(true); setJob(null); setJobId(null);
    const { data, error } = await supabase.functions.invoke("firecrawl-crawl", {
      body: {
        action: "start", url: normalized, limit, maxDepth,
        includePaths: include ? include.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        excludePaths: exclude ? exclude.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      },
    });
    setLoading(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || "Crawl failed to start");
    const id = data.data?.id || data.data?.jobId;
    if (!id) return toast.error("No crawl ID returned");
    setJobId(id);
    toast.success("Crawl started");
    poll(id);
  };

  const poll = async (id: string) => {
    for (let i = 0; i < 60; i++) {
      const { data } = await supabase.functions.invoke("firecrawl-crawl", { body: { action: "status", id } });
      if (data?.success) {
        setJob(data.data);
        if (data.data?.status === "completed" || data.data?.status === "failed") return;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  const downloadAll = () => {
    const docs = job?.data || [];
    const md = docs.map((d: any) => `# ${d.metadata?.title || d.metadata?.sourceURL}\n\n${d.metadata?.sourceURL}\n\n${d.markdown || ""}`).join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "crawl.md"; a.click();
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Layers className="h-5 w-5" /> Crawl</h1>
          <p className="text-sm text-muted-foreground">Recursively scrape every reachable page on a site.</p>
        </div>
        <div className="space-y-4 border rounded-2xl p-5 bg-card">
          <div>
            <Label>Site URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Page limit</Label><Input type="number" value={limit} onChange={(e) => setLimit(+e.target.value)} /></div>
            <div><Label>Max depth</Label><Input type="number" value={maxDepth} onChange={(e) => setMaxDepth(+e.target.value)} /></div>
          </div>
          <div><Label>Include paths (comma-separated, optional)</Label><Input value={include} onChange={(e) => setInclude(e.target.value)} placeholder="/docs/*, /blog/*" /></div>
          <div><Label>Exclude paths (optional)</Label><Input value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="/login, /api/*" /></div>
          <Button onClick={start} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Start crawl
          </Button>
        </div>

        {jobId && (
          <div className="border rounded-2xl p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Job ID</div>
                <div className="font-mono text-xs">{jobId}</div>
              </div>
              <div className="text-sm">
                Status: <span className="font-medium">{job?.status || "pending"}</span> · {job?.completed ?? 0}/{job?.total ?? "?"}
              </div>
            </div>
            {job?.data?.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={downloadAll}><Download className="h-3 w-3 mr-1" /> Download combined .md</Button>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {job.data.map((d: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-2 border rounded">
                      <ExternalLink className="h-3 w-3" />
                      <a href={d.metadata?.sourceURL} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{d.metadata?.title || d.metadata?.sourceURL}</a>
                      <span className="text-muted-foreground ml-auto">{(d.markdown?.length || 0).toLocaleString()} chars</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
