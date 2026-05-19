import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search as SearchIcon, Download, Copy, ChevronDown, Loader2, ExternalLink } from "lucide-react";
import { estimateSearchCost } from "@/lib/credits";

const TIME_FILTERS = [
  { value: "any", label: "Any time" },
  { value: "qdr:h", label: "Past hour" },
  { value: "qdr:d", label: "Past 24 hours" },
  { value: "qdr:w", label: "Past week" },
  { value: "qdr:m", label: "Past month" },
  { value: "qdr:y", label: "Past year" },
];

type SearchResult = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export default function SearchPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [limit, setLimit] = useState(10);
  const [tbs, setTbs] = useState("any");
  const [country, setCountry] = useState("");
  const [lang, setLang] = useState("");
  const [scrapeResults, setScrapeResults] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const cost = estimateSearchCost(limit, scrapeResults, ["markdown"]);

  const run = async () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setLoading(true);
    setResults(null);

    const { data: jobRow } = await supabase.from("jobs").insert({
      user_id: user!.id,
      endpoint: "search",
      input_query: query,
      status: "running",
      formats: scrapeResults ? ["markdown"] : [],
      options: { limit, tbs, country, lang, scrapeResults },
    }).select().single();

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-search", {
        body: {
          query,
          limit,
          tbs: tbs === "any" ? undefined : tbs,
          country: country || undefined,
          lang: lang || undefined,
          scrapeResults,
          formats: ["markdown"],
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Search failed");
      const list: SearchResult[] = data.results || [];
      setResults(list);
      if (jobRow) await supabase.from("jobs").update({
        status: "completed", result: { results: list }, credits_used: cost,
      }).eq("id", jobRow.id);
      toast.success(`Found ${list.length} result${list.length === 1 ? "" : "s"}`);
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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Search</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Web search with optional content scraping of every result.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 sm:p-6 space-y-5">
          <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-4">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search the web — e.g. "best open-source vector databases 2025"'
              className="border-0 shadow-none focus-visible:ring-0 h-11 bg-transparent"
            />
            <Button type="submit" disabled={loading} className="h-11 px-5 bg-gradient-fire text-primary-foreground hover:opacity-95 rounded-lg">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching…</> : <>Search · {cost} cr</>}
            </Button>
          </form>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Results</Label>
              <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} results</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time</Label>
              <Select value={tbs} onValueChange={setTbs}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_FILTERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-3 rounded-lg border border-border p-3 cursor-pointer">
              <Switch checked={scrapeResults} onCheckedChange={setScrapeResults} />
              <div className="flex-1">
                <div className="text-sm font-medium">Scrape each result</div>
                <div className="text-xs text-muted-foreground">Pull clean markdown from every link.</div>
              </div>
            </label>
          </div>

          <button onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
            <ChevronDown className={`h-3.5 w-3.5 transition ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced options
          </button>
          {showAdvanced && (
            <div className="grid sm:grid-cols-2 gap-3 rounded-lg border border-border p-4">
              <div>
                <Label>Country (ISO-2)</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value.toLowerCase())} placeholder="us, gb, de…" maxLength={2} />
              </div>
              <div>
                <Label>Language</Label>
                <Input value={lang} onChange={(e) => setLang(e.target.value.toLowerCase())} placeholder="en, fr, es…" maxLength={5} />
              </div>
            </div>
          )}
        </div>

        {loading && <ResultsSkeleton />}
        {results && <ResultsView results={results} query={query} />}
      </div>
    </AppShell>
  );
}

const ResultsSkeleton = () => (
  <div className="mt-6 space-y-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    ))}
  </div>
);

const downloadBlob = (content: string, name: string, type: string) => {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

const csvEscape = (v: unknown) => {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
};

const ResultsView = ({ results, query }: { results: SearchResult[]; query: string }) => {
  const slug = query.replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase() || "search";
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const downloadCsv = () => {
    const header = "title,url,description\n";
    const rows = results.map((r) => [r.title, r.url, r.description].map(csvEscape).join(",")).join("\n");
    downloadBlob(header + rows, `${slug}.csv`, "text/csv");
  };
  const downloadJson = () => downloadBlob(JSON.stringify(results, null, 2), `${slug}.json`, "application/json");
  const downloadMd = () => {
    const md = results
      .map((r, i) => `## ${i + 1}. ${r.title || r.url}\n\n${r.url ? `<${r.url}>\n\n` : ""}${r.description || ""}${r.markdown ? `\n\n---\n\n${r.markdown}` : ""}`)
      .join("\n\n");
    downloadBlob(`# Search: ${query}\n\n${md}`, `${slug}.md`, "text/markdown");
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} for <span className="text-foreground font-medium">"{query}"</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={downloadJson}><Download className="h-3.5 w-3.5 mr-1.5" />JSON</Button>
          <Button variant="outline" size="sm" onClick={downloadMd}><Download className="h-3.5 w-3.5 mr-1.5" />Markdown</Button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No results found. Try a different query or widen your time filter.
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-base font-medium text-foreground hover:text-primary transition flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{r.title || r.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </a>
                <Button variant="ghost" size="sm" onClick={() => copy(r.url || "")} className="shrink-0 h-7"><Copy className="h-3 w-3" /></Button>
              </div>
              {r.url && <div className="text-xs text-primary/80 truncate mb-2">{r.url}</div>}
              {r.description && <p className="text-sm text-muted-foreground line-clamp-3">{r.description}</p>}
              {r.markdown && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
                    Scraped content ({Math.round(r.markdown.length / 1000)}k chars)
                  </summary>
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                    {r.markdown.slice(0, 4000)}{r.markdown.length > 4000 ? "\n\n…" : ""}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};