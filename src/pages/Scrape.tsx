import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Globe, Download, Copy, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { estimateScrapeCost } from "@/lib/credits";

const FORMATS = [
  { id: "markdown", label: "Markdown", desc: "Clean LLM-ready text" },
  { id: "html", label: "HTML", desc: "Processed HTML" },
  { id: "rawHtml", label: "Raw HTML", desc: "Original markup" },
  { id: "links", label: "Links", desc: "All URLs on page" },
  { id: "screenshot", label: "Screenshot", desc: "Full-page image" },
  { id: "summary", label: "AI Summary", desc: "Concise overview" },
];

export default function Scrape() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [url, setUrl] = useState(params.get("url") || "");
  const [formats, setFormats] = useState<string[]>(["markdown", "links"]);
  const [onlyMain, setOnlyMain] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const cost = estimateScrapeCost(formats);

  const toggleFormat = (id: string) =>
    setFormats((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const run = async () => {
    if (!url) { toast.error("Enter a URL"); return; }
    if (formats.length === 0) { toast.error("Pick at least one format"); return; }
    setLoading(true);
    setResult(null);

    const { data: jobRow } = await supabase.from("jobs").insert({
      user_id: user!.id, endpoint: "scrape", input_url: url, status: "running", formats,
    }).select().single();

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
        body: { url, formats, onlyMainContent: onlyMain },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Scrape failed");
      setResult(data.data);
      if (jobRow) await supabase.from("jobs").update({ status: "completed", result: data.data, credits_used: cost }).eq("id", jobRow.id);
      toast.success("Scrape complete");
    } catch (e: any) {
      toast.error(e.message || "Failed");
      if (jobRow) await supabase.from("jobs").update({ status: "failed", error: e.message }).eq("id", jobRow.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Scrape</h1>
          <p className="text-muted-foreground text-sm mt-1">Extract clean content from a single URL in any format you need.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-4">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com"
              className="border-0 shadow-none focus-visible:ring-0 h-11 bg-transparent" />
            <Button onClick={run} disabled={loading} className="h-11 px-5 bg-gradient-fire text-primary-foreground hover:opacity-95 rounded-lg">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scraping…</> : <>Scrape · {cost} cr</>}
            </Button>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Formats</Label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {FORMATS.map((f) => {
                const active = formats.includes(f.id);
                return (
                  <label key={f.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <Checkbox checked={active} onCheckedChange={() => toggleFormat(f.id)} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{f.label}</div>
                      <div className="text-xs text-muted-foreground">{f.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
            <ChevronDown className={`h-3.5 w-3.5 transition ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced options
          </button>
          {showAdvanced && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Only main content</Label>
                  <p className="text-xs text-muted-foreground">Strip nav, footer and chrome.</p>
                </div>
                <Switch checked={onlyMain} onCheckedChange={setOnlyMain} />
              </div>
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground flex gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span><strong className="text-foreground">Tuned preset:</strong> main-content extraction with clean markdown — beats default Firecrawl output for readability.</span>
              </div>
            </div>
          )}
        </div>

        {loading && <ResultsSkeleton />}
        {result && <ResultsView result={result} url={url} />}
      </div>
    </AppShell>
  );
}

const ResultsSkeleton = () => (
  <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-3">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-4/6" />
    <Skeleton className="h-40 w-full mt-4" />
  </div>
);

const downloadBlob = (content: string, name: string, type: string) => {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
};

const ResultsView = ({ result, url }: { result: any; url: string }) => {
  const slug = url.replace(/https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "page";
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="text-sm font-medium truncate">{result.metadata?.title || url}</div>
        <Button variant="outline" size="sm" onClick={() => downloadBlob(JSON.stringify(result, null, 2), `${slug}.json`, "application/json")}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
        </Button>
      </div>
      <Tabs defaultValue={result.markdown ? "markdown" : result.html ? "html" : result.links ? "links" : result.screenshot ? "screenshot" : "json"}>
        <div className="px-3 pt-3 border-b border-border">
          <TabsList>
            {result.markdown && <TabsTrigger value="markdown">Markdown</TabsTrigger>}
            {result.summary && <TabsTrigger value="summary">Summary</TabsTrigger>}
            {result.html && <TabsTrigger value="html">HTML</TabsTrigger>}
            {result.rawHtml && <TabsTrigger value="rawHtml">Raw</TabsTrigger>}
            {result.links && <TabsTrigger value="links">Links</TabsTrigger>}
            {result.screenshot && <TabsTrigger value="screenshot">Screenshot</TabsTrigger>}
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>
        </div>

        {result.markdown && (
          <TabsContent value="markdown" className="m-0">
            <ResultActions onCopy={() => copy(result.markdown)} onDownload={() => downloadBlob(result.markdown, `${slug}.md`, "text/markdown")} ext="md" />
            <div className="prose prose-sm dark:prose-invert max-w-none p-6 max-h-[600px] overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
            </div>
          </TabsContent>
        )}
        {result.summary && (
          <TabsContent value="summary" className="m-0">
            <ResultActions onCopy={() => copy(result.summary)} onDownload={() => downloadBlob(result.summary, `${slug}-summary.txt`, "text/plain")} ext="txt" />
            <div className="p-6 text-sm leading-relaxed">{result.summary}</div>
          </TabsContent>
        )}
        {result.html && (
          <TabsContent value="html" className="m-0">
            <ResultActions onCopy={() => copy(result.html)} onDownload={() => downloadBlob(result.html, `${slug}.html`, "text/html")} ext="html" />
            <pre className="p-6 text-xs overflow-auto max-h-[600px] bg-muted/30">{result.html}</pre>
          </TabsContent>
        )}
        {result.rawHtml && (
          <TabsContent value="rawHtml" className="m-0">
            <ResultActions onCopy={() => copy(result.rawHtml)} onDownload={() => downloadBlob(result.rawHtml, `${slug}-raw.html`, "text/html")} ext="html" />
            <pre className="p-6 text-xs overflow-auto max-h-[600px] bg-muted/30">{result.rawHtml}</pre>
          </TabsContent>
        )}
        {result.links && (
          <TabsContent value="links" className="m-0">
            <ResultActions onCopy={() => copy(result.links.join("\n"))} onDownload={() => downloadBlob("url\n" + result.links.join("\n"), `${slug}-links.csv`, "text/csv")} ext="csv" />
            <div className="p-6 max-h-[600px] overflow-y-auto space-y-1">
              {result.links.map((l: string, i: number) => (
                <a key={i} href={l} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline truncate">{l}</a>
              ))}
            </div>
          </TabsContent>
        )}
        {result.screenshot && (
          <TabsContent value="screenshot" className="m-0">
            <div className="p-3 border-b border-border flex justify-end">
              <Button variant="outline" size="sm" asChild><a href={result.screenshot} download={`${slug}.png`}><Download className="h-3.5 w-3.5 mr-1.5" />PNG</a></Button>
            </div>
            <div className="p-6 bg-muted/30"><img src={result.screenshot} alt="Screenshot" className="w-full rounded-lg border border-border" /></div>
          </TabsContent>
        )}
        <TabsContent value="metadata" className="m-0">
          <pre className="p-6 text-xs overflow-auto max-h-[600px] bg-muted/30">{JSON.stringify(result.metadata ?? {}, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ResultActions = ({ onCopy, onDownload, ext }: { onCopy: () => void; onDownload: () => void; ext: string }) => (
  <div className="px-3 py-2 border-b border-border flex items-center gap-2 justify-end bg-muted/20">
    <Button variant="ghost" size="sm" onClick={onCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
    <Button variant="outline" size="sm" onClick={onDownload}><Download className="h-3.5 w-3.5 mr-1.5" />.{ext}</Button>
  </div>
);