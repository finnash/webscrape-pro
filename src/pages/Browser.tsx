import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Activity,
  ArrowDown,
  Camera,
  Clock,
  Coins,
  ExternalLink,
  Hand,
  Keyboard,
  Loader2,
  Monitor,
  MousePointerClick,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";

type Action =
  | { type: "wait"; milliseconds: number }
  | { type: "click"; selector: string }
  | { type: "write"; text: string }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "up" | "down" }
  | { type: "screenshot"; fullPage?: boolean };

type BrowserSession = {
  scrapeId: string;
  launchUrl: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  jobId?: string;
};

const ACTION_META: Record<Action["type"], { label: string; icon: any; color: string }> = {
  click: { label: "Click", icon: MousePointerClick, color: "text-primary" },
  write: { label: "Type text", icon: Keyboard, color: "text-primary" },
  press: { label: "Press key", icon: Keyboard, color: "text-primary" },
  wait: { label: "Wait", icon: Clock, color: "text-muted-foreground" },
  scroll: { label: "Scroll", icon: ArrowDown, color: "text-primary" },
  screenshot: { label: "Screenshot", icon: Camera, color: "text-primary" },
};

const PRESETS: { name: string; url: string; actions: Action[] }[] = [
  {
    name: "Google search → first result",
    url: "https://www.google.com/search?q=firecrawl+pro",
    actions: [
      { type: "wait", milliseconds: 2000 },
      { type: "screenshot", fullPage: true },
    ],
  },
  {
    name: "Scroll a long page",
    url: "https://news.ycombinator.com",
    actions: [
      { type: "wait", milliseconds: 1000 },
      { type: "scroll", direction: "down" },
      { type: "scroll", direction: "down" },
      { type: "screenshot", fullPage: true },
    ],
  },
];

const BILLING = {
  launchScrapeCredits: 2,
  manualCreditsPerMinute: 2,
  aiPromptCreditsPerMinute: 7,
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const normalizeImageSrc = (value: string | null) => {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `data:image/png;base64,${value}`;
};

const formatCredits = (value: number) => value.toFixed(2).replace(/\.00$/, "");

export default function BrowserSessions() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const metered = loading || Boolean(session);
  const projectedManualCredits = BILLING.launchScrapeCredits + (elapsed / 60) * BILLING.manualCreditsPerMinute;

  useEffect(() => {
    if (!metered) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [metered]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("endpoint", "browser")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const addAction = (a: Action) => setActions((cur) => [...cur, a]);
  const removeAction = (i: number) => setActions((cur) => cur.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<Action>) =>
    setActions((cur) => cur.map((a, idx) => (idx === i ? ({ ...a, ...patch } as Action) : a)));

  const usePreset = (p: (typeof PRESETS)[number]) => {
    setUrl(p.url);
    setActions(p.actions);
    setResult(null);
  };

  const startManual = async () => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      toast.error("Enter a starting URL");
      return;
    }

    setLoading(true);
    setResult(null);
    setSession(null);
    let jobRow: any = null;

    try {
      const { data: inserted } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          endpoint: "browser",
          input_url: normalized,
          status: "running",
          options: { mode: "manual-live", billing: BILLING } as any,
          credits_used: BILLING.launchScrapeCredits,
        })
        .select()
        .single();
      jobRow = inserted;

      const { data, error } = await supabase.functions.invoke("firecrawl-browser", {
        body: { mode: "start", url: normalized },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Manual browser launch failed");

      const payload = data.data;
      const nextSession: BrowserSession = {
        scrapeId: payload.scrapeId,
        launchUrl: normalized,
        liveViewUrl: payload.liveViewUrl,
        interactiveLiveViewUrl: payload.interactiveLiveViewUrl,
        jobId: jobRow?.id,
      };
      setSession(nextSession);
      setResult(payload.scrape || payload);

      if (jobRow) {
        await supabase
          .from("jobs")
          .update({ result: payload, credits_used: BILLING.launchScrapeCredits })
          .eq("id", jobRow.id);
      }
      toast.success("Manual browser is live");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed to launch manual browser");
      if (jobRow) await supabase.from("jobs").update({ status: "failed", error: e.message }).eq("id", jobRow.id);
    } finally {
      setLoading(false);
    }
  };

  const stopManual = async () => {
    if (!session) return;
    setStopping(true);
    const finalCredits = Math.ceil(projectedManualCredits);

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-browser", {
        body: { mode: "stop", scrapeId: session.scrapeId },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Could not stop browser session");

      if (session.jobId) {
        await supabase
          .from("jobs")
          .update({ status: "completed", result: { session, stopped: data.data }, credits_used: finalCredits })
          .eq("id", session.jobId);
      }
      setSession(null);
      toast.success(`Browser stopped · ~${finalCredits} credits`);
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Could not stop browser session");
    } finally {
      setStopping(false);
    }
  };

  const refreshManual = async () => {
    if (!session) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-browser", {
        body: {
          mode: "interact",
          scrapeId: session.scrapeId,
          code: "await page.waitForTimeout(250); JSON.stringify({ url: page.url(), title: await page.title() });",
          language: "node",
          timeout: 10,
        },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Refresh failed");
      const payload = data.data?.data ?? data.data;
      setSession((cur) => cur ? {
        ...cur,
        liveViewUrl: payload?.liveViewUrl || cur.liveViewUrl,
        interactiveLiveViewUrl: payload?.interactiveLiveViewUrl || cur.interactiveLiveViewUrl,
      } : cur);
      toast.success("Browser view refreshed");
    } catch (e: any) {
      toast.error(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const run = async (overrideActions?: Action[]) => {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      toast.error("Enter a starting URL");
      return;
    }
    const runActions = overrideActions ?? actions;
    setLoading(true);
    setResult(null);

    const { data: jobRow } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        endpoint: "browser",
        input_url: normalized,
        status: "running",
        options: { mode: "scripted-actions", actions: runActions } as any,
      })
      .select()
      .single();

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-browser", {
        body: { mode: "actions", url: normalized, actions: runActions },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Browser run failed");
      setResult(data.data);
      const cost = data.billing?.estimatedCredits || Math.max(2, runActions.length + 1);
      if (jobRow) {
        await supabase
          .from("jobs")
          .update({ status: "completed", result: data.data, credits_used: cost })
          .eq("id", jobRow.id);
      }
      toast.success("Scripted browser run complete");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed");
      if (jobRow) await supabase.from("jobs").update({ status: "failed", error: e.message }).eq("id", jobRow.id);
    } finally {
      setLoading(false);
    }
  };

  const screenshot = useMemo(() => {
    if (!result) return null;
    if (result.screenshot) return normalizeImageSrc(result.screenshot);
    const acts = result.actions?.screenshots;
    return normalizeImageSrc(Array.isArray(acts) && acts.length ? acts[acts.length - 1] : null);
  }, [result]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Browser
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live manual browser control with a real interactive viewport, plus scripted action replay for repeatable runs.
          </p>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Starting URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-1" />
            </div>

            <div className="space-y-3 border-b border-border pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Manual live control</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px] uppercase">Interactive iframe</Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">{BILLING.manualCreditsPerMinute} cr/min</Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">Prorated/sec</Badge>
                  </div>
                </div>
                {session && <Activity className="h-5 w-5 text-primary animate-pulse" />}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {!session ? (
                  <Button onClick={startManual} disabled={loading || !url} className="col-span-2 h-11 bg-gradient-fire text-primary-foreground hover:opacity-95">
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Launching…</> : <><Hand className="mr-2 h-4 w-4" />Launch manual browser</>}
                  </Button>
                ) : (
                  <>
                    <Button onClick={refreshManual} disabled={refreshing || stopping} variant="outline" className="h-10">
                      {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Refresh
                    </Button>
                    <Button onClick={stopManual} disabled={stopping} variant="destructive" className="h-10">
                      {stopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Scripted actions ({actions.length})</Label>
                <div className="text-[10px] text-muted-foreground">optional replay</div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {actions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                    No actions — scripted mode opens the page and screenshots it.
                  </div>
                )}
                {actions.map((a, i) => {
                  const M = ACTION_META[a.type];
                  return (
                    <div key={`${a.type}-${i}`} className="rounded-lg border border-border bg-background p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <M.icon className={`h-3.5 w-3.5 ${M.color}`} />
                        <span className="text-xs font-medium">{i + 1}. {M.label}</span>
                        <button onClick={() => removeAction(i)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remove action">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {a.type === "click" && (
                        <Input value={a.selector} onChange={(e) => updateAction(i, { selector: e.target.value })} placeholder="CSS selector e.g. button#submit" className="h-8 text-xs font-mono" />
                      )}
                      {a.type === "write" && (
                        <Input value={a.text} onChange={(e) => updateAction(i, { text: e.target.value })} placeholder="Text to type" className="h-8 text-xs" />
                      )}
                      {a.type === "press" && (
                        <Input value={a.key} onChange={(e) => updateAction(i, { key: e.target.value })} placeholder="Enter, Tab, ArrowDown…" className="h-8 text-xs" />
                      )}
                      {a.type === "wait" && (
                        <Input type="number" value={a.milliseconds} onChange={(e) => updateAction(i, { milliseconds: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                <Select onValueChange={(v) => {
                  const map: Record<string, Action> = {
                    click: { type: "click", selector: "" },
                    write: { type: "write", text: "" },
                    press: { type: "press", key: "Enter" },
                    wait: { type: "wait", milliseconds: 1000 },
                    scroll: { type: "scroll", direction: "down" },
                    screenshot: { type: "screenshot", fullPage: true },
                  };
                  if (map[v]) addAction(map[v]);
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="click">Click</SelectItem>
                    <SelectItem value="write">Type text</SelectItem>
                    <SelectItem value="press">Press key</SelectItem>
                    <SelectItem value="wait">Wait</SelectItem>
                    <SelectItem value="scroll">Scroll</SelectItem>
                    <SelectItem value="screenshot">Screenshot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={() => run()} disabled={loading || Boolean(session) || !url} variant="outline" className="w-full h-10">
              {loading && !session ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</> : <><Play className="mr-2 h-4 w-4" />Run scripted replay</>}
            </Button>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"><Sparkles className="h-3 w-3" />Presets</div>
              <div className="space-y-1.5">
                {PRESETS.map((p) => (
                  <button key={p.name} onClick={() => usePreset(p)} className="w-full text-left text-xs rounded-md border border-border hover:border-primary/40 px-2.5 py-1.5">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden min-h-[560px] flex flex-col relative">
            <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 bg-muted/30">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
              </div>
              <div className="flex-1 mx-3 h-7 rounded-md bg-background border border-border px-3 flex items-center text-xs font-mono text-muted-foreground truncate">
                {session?.launchUrl || url || "about:blank"}
              </div>
              {session?.interactiveLiveViewUrl && (
                <a href={session.interactiveLiveViewUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open live browser in new tab">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {session && <Badge className="bg-primary/15 text-primary border-0 text-[10px] uppercase">Live</Badge>}
            </div>

            <div className="flex-1 bg-muted/20 p-3 sm:p-4 overflow-auto relative">
              {session?.interactiveLiveViewUrl ? (
                <iframe
                  title="Interactive browser viewport"
                  src={session.interactiveLiveViewUrl}
                  className="w-full min-h-[560px] rounded-lg border border-border bg-background shadow-elegant"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              ) : !result && !loading ? (
                <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Monitor className="h-10 w-10 mb-3 opacity-40" />
                  <div className="text-sm">Launch a manual browser to control the live viewport here.</div>
                </div>
              ) : loading ? (
                <div className="space-y-3">
                  <Skeleton className="w-full h-[440px] rounded-lg" />
                </div>
              ) : screenshot ? (
                <img src={screenshot} alt="Browser viewport" className="w-full rounded-lg border border-border shadow-elegant" />
              ) : null}

              {result?.markdown && !session && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Page markdown ({result.markdown.length} chars)</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-background border border-border max-h-64 overflow-auto whitespace-pre-wrap">{result.markdown.slice(0, 5000)}</pre>
                </details>
              )}
            </div>

            {metered && (
              <div className="absolute top-14 right-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-elegant px-3 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 max-w-[260px]">
                <div className="h-8 w-8 rounded-lg bg-gradient-fire flex items-center justify-center shrink-0">
                  <Coins className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="text-xs min-w-0">
                  <div className="font-semibold tabular-nums">~{formatCredits(projectedManualCredits)} credits</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · {BILLING.manualCreditsPerMinute} cr/min + {BILLING.launchScrapeCredits} cr launch
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Recent browser sessions</h2>
          {history === null ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">No browser sessions yet.</div>
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {history.map((j) => (
                <div key={j.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <div className={`h-2 w-2 rounded-full ${j.status === "completed" ? "bg-primary" : j.status === "failed" ? "bg-destructive" : "bg-muted-foreground"}`} />
                  <div className="flex-1 truncate font-mono text-xs">{j.input_url}</div>
                  <div className="text-xs text-muted-foreground">{j.options?.mode || "browser"} · {j.credits_used || 0} cr</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
