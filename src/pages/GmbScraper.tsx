import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { gateAndConsume } from "@/lib/gate";
import {
  MapPin, Search, Loader2, Download, Star, Phone, Globe, ExternalLink,
  History, Trash2, Filter, ChevronDown,
} from "lucide-react";

type Business = {
  name?: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  url?: string;
};

type Run = {
  id: string;
  keyword: string;
  location: string | null;
  filters: any;
  limit_count: number;
  status: string;
  results: Business[];
  result_count: number;
  error: string | null;
  created_at: string;
};

const GmbLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M12 2C7.589 2 4 5.589 4 9.995 3.971 16.44 11.696 21.784 12 22c0 0 8.029-5.56 8-12.005C20 5.589 16.411 2 12 2z" />
    <circle cx="12" cy="10" r="3.2" fill="#fff" />
  </svg>
);

const toCsv = (rows: Business[]) => {
  const headers = ["name","category","address","phone","website","rating","reviews","hours","url"];
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc((r as any)[h])).join(","))].join("\n");
};

const downloadBlob = (content: string, name: string, type: string) => {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  URL.revokeObjectURL(a.href);
};

export default function GmbScraper() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(20);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Run | null>(null);
  const [history, setHistory] = useState<Run[]>([]);

  const cost = Math.max(2, Math.ceil(limit / 10));

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gmb_scrape_runs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as any) || []);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [user]);

  const run = async () => {
    if (!keyword.trim()) { toast.error("Enter a keyword (e.g. 'dentist')"); return; }
    if (!(await gateAndConsume(cost))) return;

    setLoading(true);
    setCurrent(null);

    const filters = { noWebsiteOnly, hasPhone, openNow, minRating, category: category || null };

    const { data: runRow } = await supabase
      .from("gmb_scrape_runs" as any)
      .insert({
        user_id: user!.id,
        keyword: keyword.trim(),
        location: location.trim() || null,
        filters,
        limit_count: limit,
        status: "running",
      })
      .select()
      .single();

    try {
      const { data, error } = await supabase.functions.invoke("gmb-scrape", {
        body: {
          keyword: keyword.trim(),
          location: location.trim() || undefined,
          category: category.trim() || undefined,
          limit,
          noWebsiteOnly,
          hasPhone,
          openNow,
          minRating: minRating > 0 ? minRating : undefined,
        },
      });
      if (error) throw new Error((data as any)?.error || error.message || "Scrape failed");
      if (!data?.success) throw new Error(data?.error || "Scrape failed");

      const businesses: Business[] = data.businesses || [];
      const updated = {
        ...(runRow as any),
        status: "completed",
        results: businesses,
        result_count: businesses.length,
      } as Run;

      if (runRow) {
        await supabase.from("gmb_scrape_runs" as any)
          .update({ status: "completed", results: businesses, result_count: businesses.length, credits_used: cost })
          .eq("id", (runRow as any).id);
      }
      setCurrent(updated);
      toast.success(`Found ${businesses.length} business${businesses.length === 1 ? "" : "es"}`);
      loadHistory();
    } catch (e: any) {
      const msg = e.message || "Failed";
      toast.error(msg);
      if (runRow) await supabase.from("gmb_scrape_runs" as any)
        .update({ status: "failed", error: msg }).eq("id", (runRow as any).id);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("gmb_scrape_runs" as any).delete().eq("id", id);
    if (current?.id === id) setCurrent(null);
    loadHistory();
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-hero pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6 flex items-center gap-3 animate-fade-in">
            <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-elegant">
              <GmbLogo />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">GMB Scraper</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Pull Google Maps business listings by keyword — filter, export, and target leads with no website.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 sm:p-6 space-y-5 animate-fade-in">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Keyword (e.g. dentist, plumber, coffee shop)"
                  className="border-0 shadow-none focus-visible:ring-0 h-10 bg-transparent"
                  onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location (city, ZIP, region)"
                  className="border-0 shadow-none focus-visible:ring-0 h-10 bg-transparent"
                  onKeyDown={(e) => { if (e.key === "Enter") run(); }}
                />
              </div>
              <Button onClick={run} disabled={loading} className="h-12 px-5 bg-gradient-fire text-primary-foreground hover:opacity-95 rounded-xl">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scraping…</> : <>Scrape · {cost} cr</>}
              </Button>
            </div>

            <button onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
              <ChevronDown className={`h-3.5 w-3.5 transition ${showAdvanced ? "rotate-180" : ""}`} />
              <Filter className="h-3.5 w-3.5" />
              Advanced filters
            </button>

            {showAdvanced && (
              <div className="rounded-lg border border-border p-4 space-y-4 animate-fade-in">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Category refinement</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. cosmetic, emergency" className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Result limit</Label>
                    <Input type="number" min={1} max={100} value={limit}
                      onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                      className="mt-1 h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Minimum rating</Label>
                    <Input type="number" min={0} max={5} step={0.1} value={minRating}
                      onChange={(e) => setMinRating(Math.min(5, Math.max(0, Number(e.target.value) || 0)))}
                      className="mt-1 h-9" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <FilterToggle
                    title="No website only"
                    desc="Perfect for cold outreach — businesses without a website."
                    checked={noWebsiteOnly} onChange={setNoWebsiteOnly}
                  />
                  <FilterToggle
                    title="Has phone number"
                    desc="Only return listings with a callable number."
                    checked={hasPhone} onChange={setHasPhone}
                  />
                  <FilterToggle
                    title="Open now"
                    desc="Prefer businesses currently marked open."
                    checked={openNow} onChange={setOpenNow}
                  />
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 space-y-3 animate-fade-in">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {current && <ResultsView run={current} />}

          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <History className="h-4 w-4" /> Recent runs
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center">
                Past scrapes will appear here. They persist across sessions.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/40 transition">
                    <button onClick={() => setCurrent(h)} className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">{h.keyword}{h.location ? ` · ${h.location}` : ""}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()} · {h.result_count} results · {h.status}
                      </div>
                    </button>
                    <Badge variant="secondary" className="text-[10px]">{h.limit_count} cap</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(h.id)} aria-label="Delete run">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const FilterToggle = ({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (b: boolean) => void }) => (
  <div className={`flex items-start gap-3 rounded-lg border p-3 transition ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
    <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    <div className="flex-1">
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  </div>
);

const ResultsView = ({ run }: { run: Run }) => {
  const rows = run.results || [];
  const slug = run.keyword.replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "gmb";

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card shadow-elegant overflow-hidden animate-fade-in">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{run.keyword}{run.location ? ` · ${run.location}` : ""}</div>
          <div className="text-[11px] text-muted-foreground">{rows.length} results</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadBlob(toCsv(rows), `${slug}.csv`, "text/csv")}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(JSON.stringify(rows, null, 2), `${slug}.json`, "application/json")}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cards">
        <div className="px-3 pt-3 border-b border-border">
          <TabsList>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cards" className="m-0 p-4 grid sm:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto">
          {rows.length === 0 && <div className="text-sm text-muted-foreground col-span-full p-6 text-center">No businesses matched your filters.</div>}
          {rows.map((b, i) => (
            <div key={i} className="rounded-xl border border-border p-4 hover:border-primary/40 transition bg-background/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{b.name || "Unnamed"}</div>
                  {b.category && <div className="text-[11px] text-muted-foreground">{b.category}</div>}
                </div>
                {typeof b.rating === "number" && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" /> {b.rating}{b.reviews ? ` (${b.reviews})` : ""}
                  </Badge>
                )}
              </div>
              {b.address && <div className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5"><MapPin className="h-3 w-3 mt-0.5 shrink-0" />{b.address}</div>}
              {b.phone && <div className="text-xs mt-1 flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />{b.phone}</div>}
              <div className="mt-2 flex items-center gap-3 text-[11px]">
                {b.website ? (
                  <a href={b.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 truncate max-w-[200px]">
                    <Globe className="h-3 w-3" /> {b.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1"><Globe className="h-3 w-3" /> No website</span>
                )}
                {b.url && (
                  <a href={b.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
                    Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="table" className="m-0">
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {["Name","Category","Address","Phone","Website","Rating","Reviews"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{b.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.category}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.address}</td>
                    <td className="px-3 py-2">{b.phone}</td>
                    <td className="px-3 py-2">{b.website ? <a className="text-primary hover:underline" href={b.website} target="_blank" rel="noreferrer">{b.website.replace(/^https?:\/\//, "")}</a> : <span className="text-amber-500">—</span>}</td>
                    <td className="px-3 py-2">{b.rating ?? ""}</td>
                    <td className="px-3 py-2">{b.reviews ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="json" className="m-0">
          <pre className="p-6 text-xs overflow-auto max-h-[640px] bg-muted/30">{JSON.stringify(rows, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
};