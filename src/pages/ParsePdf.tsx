import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Copy, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { gateAndConsume } from "@/lib/gate";

export default function ParsePdf() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!url.trim()) return toast.error("Enter a PDF URL");
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    if (!/\.pdf(\?|$)/i.test(normalized)) {
      // soft warn
      toast.message("URL doesn't end in .pdf — we will still try.");
    }
    if (!(await gateAndConsume(3))) return;
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
      body: { url: normalized, formats: ["markdown", "summary"], onlyMainContent: true },
    });
    setLoading(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || "Parse failed");
    setResult(data.data);
  };

  const md = result?.markdown || "";

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Parse PDF</h1>
          <p className="text-sm text-muted-foreground">Turn a PDF URL into clean markdown + AI summary.</p>
        </div>
        <div className="space-y-4 border rounded-2xl p-5 bg-card">
          <div><Label>PDF URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://arxiv.org/pdf/2401.00001.pdf" /></div>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Parse
          </Button>
        </div>

        {result?.summary && (
          <div className="border rounded-2xl p-5 bg-card">
            <div className="text-sm font-medium mb-2">AI summary</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{result.summary}</div>
          </div>
        )}

        {md && (
          <div className="border rounded-2xl p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Document ({md.length.toLocaleString()} chars)</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(md); toast.success("Copied"); }}><Copy className="h-3 w-3 mr-1" /> Copy MD</Button>
                <Button size="sm" variant="outline" onClick={() => { const b = new Blob([md], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "document.md"; a.click(); }}><Download className="h-3 w-3 mr-1" /> Download</Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none max-h-[600px] overflow-auto p-3 bg-muted/20 rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
