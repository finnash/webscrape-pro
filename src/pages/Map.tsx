import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Map as MapIcon, Loader2, Download, Search, ExternalLink, X } from "lucide-react";

export default function MapPage() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [search, setSearch] = useState("");
  const [includeSub, setIncludeSub] = useState(false);
  const [limit, setLimit] = useState(500);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(
    () => (links || []).filter((l) => l.toLowerCase().includes(filter.toLowerCase())),
    [links, filter]
  );

  const run = async () => {
    let normalized = url.trim();
    if (!normalized) { toast.error("Enter a URL"); return; }
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    setLoading(true);
    setLinks(null);
    const { data: jobRow } = await supabase.from("jobs").insert({
      user_id: user!.id, endpoint: "map", input_url: normalized, status: "running",
      options: { search, limit, includeSubdomains: includeSub },
    }).select().single();

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-map", {
        body: { url: normalized, search: search || undefined, limit, includeSubdomains: includeSub },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Map failed");
      setLinks(data.links);
      if (jobRow) await supabase.from("jobs").update({ status: "completed", result: { links: data.links }, credits_used: 1 }).eq("id", jobRow.id);
      toast.success(`Found ${data.count} URLs`);
    } catch (e: any) {
      toast.error(e.message);
      if (jobRow) await supabase.from("jobs").update({ status: "failed", error: e.message }).eq("id", jobRow.id);
    } finally {
      setLoading(false);
    }
  };

  const download = (kind: "csv" | "json" | "txt") => {
    if (!links) return;
    const slug = url.replace(/https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    const content = kind === "csv" ? "url\n" + links.join("\n")
      : kind === "json" ? JSON.stringify(links, null, 2)
      : links.join("\n");
    const blob = new Blob([content], { type: kind === "json" ? "application/json" : "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-map.${kind}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-hero pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6 flex items-center gap-3 animate-fade-in">
            <div className="h-10 w-10 rounded-xl bg-gradient-fire flex items-center justify-center shadow-glow">
              <MapIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Map</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Discover every URL on a website in seconds.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 sm:p-6 space-y-5 animate-fade-in">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-4">
              <MapIcon className="h-5 w-5 text-muted-foreground" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com"
                className="border-0 shadow-none focus-visible:ring-0 h-11 bg-transparent"
                onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
              <Button onClick={run} disabled={loading} className="h-11 px-5 bg-gradient-fire text-primary-foreground rounded-lg">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mapping…</> : <>Map · 1 cr</>}
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Filter (server-side)</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='e.g. "blog"' className="mt-1 h-9" />
              </div>
              <div>
                <Label>Limit</Label>
                <Input type="number" min={1} max={5000} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 500)} className="mt-1 h-9" />
              </div>
              <label className="flex items-end gap-3 rounded-lg border border-border p-3 cursor-pointer">
                <Switch checked={includeSub} onCheckedChange={setIncludeSub} />
                <div>
                  <div className="text-sm font-medium">Subdomains</div>
                  <div className="text-xs text-muted-foreground">Include subdomain URLs</div>
                </div>
              </label>
            </div>
          </div>

          {loading && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-2 animate-fade-in">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          )}

          {links && (
            <div className="mt-6 rounded-2xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Badge>{links.length} URLs</Badge>
                  {filter && <Badge variant="secondary">{filtered.length} filtered</Badge>}
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter URLs…" className="pl-8 h-8 text-xs" />
                    {filter && <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => download("csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
                  <Button variant="outline" size="sm" onClick={() => download("json")}><Download className="h-3.5 w-3.5 mr-1" />JSON</Button>
                  <Button variant="outline" size="sm" onClick={() => download("txt")}><Download className="h-3.5 w-3.5 mr-1" />TXT</Button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No URLs match your filter.</div>
                ) : filtered.map((l, i) => (
                  <a key={i} href={l} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/40 transition group">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{i + 1}</span>
                    <span className="truncate flex-1">{l}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}