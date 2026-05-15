import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download, ExternalLink, Loader2, CheckCircle2, XCircle, Archive, ShieldCheck, ShieldAlert, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Run = {
  id: string; name: string; status: string; kind: string | null;
  progress: any[]; result: any; error: string | null;
  started_at: string | null; finished_at: string | null; recipe: any[];
};

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(s: any) {
  const v = String(s ?? "").replace(/"/g, '""');
  return /[",\n]/.test(v) ? `"${v}"` : v;
}

// markdown -> rich HTML for copy-format paste into Medium / Notion / Google Docs
function mdToRichHtml(md: string) {
  if (!md) return "";
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false, inOl = false, inCode = false;
  const inline = (t: string) => t
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  for (const raw of lines) {
    const l = raw;
    if (l.startsWith("```")) { if (inCode) { out.push("</code></pre>"); inCode = false; } else { out.push("<pre><code>"); inCode = true; } continue; }
    if (inCode) { out.push(inline(l) + "\n"); continue; }
    if (/^#{1,6}\s/.test(l)) { const n = l.match(/^#+/)![0].length; out.push(`<h${n}>${inline(l.replace(/^#+\s/, ""))}</h${n}>`); continue; }
    if (/^>\s/.test(l)) { out.push(`<blockquote>${inline(l.replace(/^>\s/, ""))}</blockquote>`); continue; }
    if (/^[-*]\s/.test(l)) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(l.replace(/^[-*]\s/, ""))}</li>`); continue; }
    if (/^\d+\.\s/.test(l)) { if (!inOl) { out.push("<ol>"); inOl = true; } out.push(`<li>${inline(l.replace(/^\d+\.\s/, ""))}</li>`); continue; }
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
    if (l.trim() === "") { out.push(""); continue; }
    out.push(`<p>${inline(l)}</p>`);
  }
  if (inList) out.push("</ul>"); if (inOl) out.push("</ol>"); if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

async function copyRich(md: string) {
  const html = mdToRichHtml(md);
  try {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([md], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    toast({ title: "Copied with formatting", description: "Paste into Medium, Notion, or Docs." });
  } catch {
    await navigator.clipboard.writeText(md);
    toast({ title: "Copied as markdown" });
  }
}

export function RunDrawer({ runId, open, onOpenChange }: { runId: string | null; open: boolean; onOpenChange: (o: boolean) => void; }) {
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    if (!runId || !open) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.from("snapshot_runs").select("*").eq("id", runId).single();
      if (mounted) setRun(data as any);
    };
    load();
    const ch = supabase.channel(`run-${runId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "snapshot_runs", filter: `id=eq.${runId}` }, (p: any) => {
        if (mounted) setRun(p.new);
      }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [runId, open]);

  const items: any[] = run?.result?.items || [];
  const summary: string | null = run?.result?.summary || null;
  const totalSteps = run?.recipe?.length || 1;
  const stepsDone = useMemo(() => {
    const msgs = (run?.progress || []).filter((p: any) => /^Step \d+\//.test(p.msg || ""));
    return msgs.length;
  }, [run?.progress]);
  const pct = run?.status === "succeeded" ? 100 : run?.status === "failed" ? 100 : Math.min(95, Math.round((stepsDone / totalSteps) * 100));

  const downloadAllMd = () => {
    const md = items.map((x, i) => `# ${x.title || `Item ${i + 1}`}\n\n${x.url}\n\n${x.markdown || x.summary || ""}`).join("\n\n---\n\n");
    download(`${run?.name || "snapshot"}.md`, "text/markdown", md);
  };
  const downloadCsv = () => {
    const rows = [["title", "url", "author", "summary"], ...items.map((x) => [x.title, x.url, x.author, (x.summary || "").replace(/\n/g, " ")])];
    download(`${run?.name || "snapshot"}.csv`, "text/csv", rows.map((r) => r.map(csvEscape).join(",")).join("\n"));
  };
  const downloadLinks = () => download(`${run?.name || "snapshot"}-links.txt`, "text/plain", items.map((x) => x.url).join("\n"));
  const downloadJson = () => download(`${run?.name || "snapshot"}.json`, "application/json", JSON.stringify(run?.result, null, 2));
  const downloadTitles = () => download(`${run?.name || "snapshot"}-titles.txt`, "text/plain", items.map((x) => x.title || "").join("\n"));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{run?.name || "Snapshot run"}</SheetTitle>
            <StatusBadge status={run?.status} />
          </div>
          <SheetDescription>
            {run?.started_at && new Date(run.started_at).toLocaleString()}
            {run?.finished_at && ` · finished ${new Date(run.finished_at).toLocaleTimeString()}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Progress value={pct} className="h-1.5" />
          <div className="mt-1 text-[10px] text-muted-foreground flex justify-between">
            <span>{stepsDone}/{totalSteps} steps · {items.length} items</span>
            <span>{pct}%</span>
          </div>
        </div>

        <Tabs defaultValue="results" className="mt-4">
          <TabsList>
            <TabsTrigger value="results">Results ({items.length})</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="logs">Live log</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4 mt-4">
            {run?.status === "running" && items.length === 0 && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}
            {items.length === 0 && run?.status !== "running" && (
              <div className="text-sm text-muted-foreground border border-dashed rounded-xl p-6 text-center">No items yet.</div>
            )}
            {items.map((it, i) => <ItemCard key={i} item={it} />)}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            {summary ? (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => copyRich(summary)}><Copy className="h-3 w-3 mr-1" /> Copy formatted</Button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm border rounded-xl p-4 bg-muted/20">{summary}</div>
              </div>
            ) : <div className="text-sm text-muted-foreground">No summary produced.</div>}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <ScrollArea className="h-96 border rounded-xl p-3 bg-muted/20">
              <pre className="text-[10px] font-mono whitespace-pre-wrap">
                {(run?.progress || []).map((p: any, i: number) =>
                  `[${new Date(p.at).toLocaleTimeString()}] ${(p.level || "info").toUpperCase()} ${p.msg}`
                ).join("\n")}
                {run?.error && `\n\nERROR: ${run.error}`}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="export" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Bundle the entire run in your preferred format.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={downloadAllMd}><Download className="h-3 w-3 mr-1" /> Combined .md</Button>
              <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-3 w-3 mr-1" /> Index .csv</Button>
              <Button variant="outline" size="sm" onClick={downloadJson}><Download className="h-3 w-3 mr-1" /> Raw .json</Button>
              <Button variant="outline" size="sm" onClick={downloadLinks}><Download className="h-3 w-3 mr-1" /> Links .txt</Button>
              <Button variant="outline" size="sm" onClick={downloadTitles}><Download className="h-3 w-3 mr-1" /> Titles .txt</Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { v: any; icon: any; label: string }> = {
    pending: { v: "secondary", icon: Loader2, label: "Pending" },
    running: { v: "default", icon: Loader2, label: "Running" },
    succeeded: { v: "secondary", icon: CheckCircle2, label: "Succeeded" },
    failed: { v: "destructive", icon: XCircle, label: "Failed" },
  };
  const m = map[status || "pending"] || map.pending;
  const Icon = m.icon;
  return <Badge variant={m.v} className="text-[10px] gap-1"><Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} /> {m.label}</Badge>;
}

function ItemCard({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const md: string = item.markdown || item.summary || "";
  const wordCount = md.split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(wordCount / 220));
  const imageCount = (md.match(/!\[/g) || []).length;
  return (
    <div className="border rounded-2xl overflow-hidden bg-card">
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              {item.viaArchive && <Badge variant="secondary" className="text-[9px] gap-1"><Archive className="h-2.5 w-2.5" /> Archive</Badge>}
              {item.verified === true && <Badge variant="secondary" className="text-[9px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-2.5 w-2.5" /> Full</Badge>}
              {item.verified === false && <Badge variant="destructive" className="text-[9px] gap-1"><ShieldAlert className="h-2.5 w-2.5" /> Partial</Badge>}
              {item.author && <span>{item.author}</span>}
              <span>· {readMin} min read · {wordCount} words · {imageCount} img</span>
            </div>
            <h3 className="text-base font-semibold leading-snug mt-1 line-clamp-2">{item.title || item.url}</h3>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1">
              {item.url} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
        {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
        {item.error && <p className="text-xs text-destructive">Error: {item.error}</p>}
        {item.attempts && item.attempts.length > 1 && (
          <div className="text-[10px] text-muted-foreground">Recovery path: {item.attempts.join(" → ")}</div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => copyRich(md)}><Copy className="h-3 w-3 mr-1" /> Copy format</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigator.clipboard.writeText(md).then(() => toast({ title: "Copied markdown" }))}>.md</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => download(`${(item.title || "post").slice(0, 40)}.md`, "text/markdown", md)}><Download className="h-3 w-3 mr-1" />MD</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => download(`${(item.title || "post").slice(0, 40)}.txt`, "text/plain", md.replace(/[#*>`_-]/g, ""))}><Download className="h-3 w-3 mr-1" />TXT</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setOpen((o) => !o)}>
            <BookOpen className="h-3 w-3 mr-1" /> {open ? "Close reader" : "Read"}
          </Button>
        </div>
      </div>
      {open && (
        <ReaderView item={item} md={md} readMin={readMin} wordCount={wordCount} />
      )}
    </div>
  );
}

function ReaderView({ item, md, readMin, wordCount }: { item: any; md: string; readMin: number; wordCount: number }) {
  return (
    <div className="border-t bg-[#fafaf7] dark:bg-zinc-950">
      <article className="mx-auto max-w-[680px] px-6 sm:px-10 py-10">
        <header className="mb-8 space-y-4 border-b border-border/60 pb-6">
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.viaArchive && <Badge variant="secondary" className="gap-1"><Archive className="h-2.5 w-2.5" /> via {item.archiveLabel || "archive"}</Badge>}
            {item.verified === true && <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-2.5 w-2.5" /> Verified full article</Badge>}
            {item.verified === false && <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-2.5 w-2.5" /> Partial / paywalled</Badge>}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl leading-[1.15] tracking-tight text-foreground">
            {item.title || item.url}
          </h1>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {item.author && <span className="font-medium text-foreground">{item.author}</span>}
              <span>·</span>
              <span>{readMin} min read</span>
              <span>·</span>
              <span>{wordCount.toLocaleString()} words</span>
            </div>
            <a href={item.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
              Original <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>
        <div className="reader-prose prose prose-zinc dark:prose-invert max-w-none
                        prose-headings:font-serif prose-headings:tracking-tight
                        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                        prose-p:font-serif prose-p:text-[18px] prose-p:leading-[1.75] prose-p:text-zinc-800 dark:prose-p:text-zinc-200
                        prose-li:font-serif prose-li:text-[17px] prose-li:leading-[1.7]
                        prose-blockquote:border-l-4 prose-blockquote:border-primary/60 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:font-serif
                        prose-a:text-primary prose-a:underline-offset-2
                        prose-img:rounded-xl prose-img:my-6 prose-img:shadow-sm
                        prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-xl">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" />,
              img: ({ node, ...p }) => <img {...p} loading="lazy" />,
            }}
          >
            {md || "_(empty)_"}
          </ReactMarkdown>
        </div>
        <footer className="mt-10 pt-6 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div>End of article</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyRich(md)}><Copy className="h-3 w-3 mr-1" /> Copy formatted</Button>
            <a href={item.url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" className="h-7 text-xs">Open source <ExternalLink className="h-3 w-3 ml-1" /></Button>
            </a>
          </div>
        </footer>
      </article>
    </div>
  );
}