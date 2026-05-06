import { useEffect, useMemo, useRef, useState } from "react";
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
import { Monitor, Trash2, Play, Loader2, Camera, MousePointerClick, Keyboard, Clock, ArrowDown, Sparkles, Code2, Coins, Hand } from "lucide-react";

type Action =
  | { type: "wait"; milliseconds: number }
  | { type: "click"; selector: string }
  | { type: "write"; text: string }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "up" | "down" }
  | { type: "screenshot"; fullPage?: boolean }
  | { type: "executeJavascript"; script: string };

const ACTION_META: Record<Action["type"], { label: string; icon: any; color: string }> = {
  click:      { label: "Click",      icon: MousePointerClick, color: "text-blue-500" },
  write:      { label: "Type text",  icon: Keyboard,          color: "text-purple-500" },
  press:      { label: "Press key",  icon: Keyboard,          color: "text-purple-500" },
  wait:       { label: "Wait",       icon: Clock,             color: "text-amber-500" },
  scroll:     { label: "Scroll",     icon: ArrowDown,         color: "text-emerald-500" },
  screenshot: { label: "Screenshot", icon: Camera,            color: "text-primary" },
  executeJavascript: { label: "JS click @ point", icon: Code2, color: "text-pink-500" },
};

const PRESETS: { name: string; url: string; actions: Action[] }[] = [
  {
    name: "Google search → first result",
    url: "https://www.google.com",
    actions: [
      { type: "click", selector: "textarea[name='q']" },
      { type: "write", text: "firecrawl pro" },
      { type: "press", key: "Enter" },
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

export default function BrowserSessions() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Firecrawl browser pricing reference (v2):
  // ~1 credit / scrape call + ~1 credit per page action. For a long-running
  // headless session this works out to roughly 60 credits/min at 1 action/sec.
  const CREDITS_PER_MIN = 60;
  const liveCredits = Math.max(1, Math.ceil((elapsed / 60) * CREDITS_PER_MIN));

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const loadHistory = async () => {
    const { data } = await supabase.from("jobs").select("*")
      .eq("endpoint", "browser").order("created_at", { ascending: false }).limit(20);
    setHistory(data || []);
  };
  useEffect(() => { if (user) loadHistory(); }, [user]);

  const addAction = (a: Action) => setActions((cur) => [...cur, a]);
  const removeAction = (i: number) => setActions((cur) => cur.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<Action>) =>
    setActions((cur) => cur.map((a, idx) => idx === i ? ({ ...a, ...patch } as Action) : a));

  const usePreset = (p: typeof PRESETS[number]) => { setUrl(p.url); setActions(p.actions); setResult(null); };

  const run = async (overrideActions?: Action[]) => {
    if (!url.trim()) { toast.error("Enter a starting URL"); return; }
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    const runActions = overrideActions ?? actions;
    setLoading(true);

    const { data: jobRow } = await supabase.from("jobs").insert({
      user_id: user!.id, endpoint: "browser", input_url: normalized, status: "running",
      options: { actions: runActions } as any,
    }).select().single();

    try {
      const { data, error } = await supabase.functions.invoke("firecrawl-browser", {
        body: { url: normalized, actions: runActions },
      });
      if (error) throw new Error(data?.error || error.message);
      if (!data?.success) throw new Error(data?.error || "Browser run failed");
      setResult(data.data);
      const cost = Math.max(2, runActions.length + 1);
      if (jobRow) await supabase.from("jobs").update({ status: "completed", result: data.data, credits_used: cost }).eq("id", jobRow.id);
      toast.success("Browser session complete");
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Failed");
      if (jobRow) await supabase.from("jobs").update({ status: "failed", error: e.message }).eq("id", jobRow.id);
    } finally { setLoading(false); }
  };

  const screenshot = useMemo(() => {
    if (!result) return null;
    if (result.screenshot) return result.screenshot;
    const acts = result.actions?.screenshots;
    return Array.isArray(acts) && acts.length ? acts[acts.length - 1] : null;
  }, [result]);

  // Manual click on the rendered screenshot → translate to natural-image
  // coordinates and append a JS click action, then replay the session.
  const handleViewportClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!manualMode || !imgRef.current || loading) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    const x = Math.round(sx * (img.naturalWidth || 1280));
    const y = Math.round(sy * (img.naturalHeight || 800));
    const jsAction: Action = {
      type: "executeJavascript",
      script: `(()=>{const el=document.elementFromPoint(${x},${y});if(el){el.scrollIntoView({block:'center'});el.click();}})();`,
    };
    const next: Action[] = [...actions, jsAction, { type: "wait", milliseconds: 1200 }, { type: "screenshot", fullPage: true }];
    setActions(next);
    toast.message(`Clicked @ ${x},${y} — replaying…`);
    await run(next);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Browser
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Spin up a real headless browser, drive it with click / type / scroll actions, and capture the final state. Foundation for agent control.
          </p>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-4">
          <div className="rounded-2xl border border-border bg-card shadow-elegant p-5 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Starting URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-1" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Actions ({actions.length})</Label>
                <div className="text-[10px] text-muted-foreground">runs in order</div>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {actions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                    No actions — we'll just open the page and screenshot it.
                  </div>
                )}
                {actions.map((a, i) => {
                  const M = ACTION_META[a.type];
                  return (
                    <div key={i} className="rounded-lg border border-border bg-background p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <M.icon className={`h-3.5 w-3.5 ${M.color}`} />
                        <span className="text-xs font-medium">{i + 1}. {M.label}</span>
                        <button onClick={() => removeAction(i)} className="ml-auto text-muted-foreground hover:text-destructive">
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
                    wait:  { type: "wait", milliseconds: 1000 },
                    scroll:{ type: "scroll", direction: "down" },
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

            <Button onClick={() => run()} disabled={loading || !url} className="w-full h-11 bg-gradient-fire text-primary-foreground hover:opacity-95">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running…</> : <><Play className="mr-2 h-4 w-4" />Launch browser</>}
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

          <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden min-h-[500px] flex flex-col relative">
            <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 bg-muted/30">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-3 h-7 rounded-md bg-background border border-border px-3 flex items-center text-xs font-mono text-muted-foreground truncate">
                {url || "about:blank"}
              </div>
              <button
                onClick={() => setManualMode((m) => !m)}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border transition ${manualMode ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:text-foreground"}`}
                title="Click anywhere on the viewport to interact with the page"
              >
                <Hand className="h-3 w-3 inline mr-1" />Manual
              </button>
              {loading && <Badge className="bg-primary/15 text-primary border-0 text-[10px] uppercase">Live</Badge>}
            </div>
            <div className="flex-1 bg-muted/20 p-4 overflow-auto relative">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Monitor className="h-10 w-10 mb-3 opacity-40" />
                  <div className="text-sm">Launch a session to see the browser viewport here.</div>
                </div>
              )}
              {loading && (
                <div className="space-y-3">
                  <Skeleton className="w-full h-[400px] rounded-lg" />
                </div>
              )}
              {screenshot && (
                <img
                  ref={imgRef}
                  src={screenshot}
                  alt="Browser viewport"
                  onClick={handleViewportClick}
                  className={`w-full rounded-lg border border-border shadow-elegant ${manualMode ? "cursor-crosshair ring-2 ring-primary/40" : ""}`}
                />
              )}
              {manualMode && screenshot && (
                <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <MousePointerClick className="h-3 w-3 text-primary" />
                  Manual mode on — click anywhere on the page to interact. Each click replays the session (~{Math.max(2, actions.length + 3)} credits).
                </div>
              )}
              {result?.markdown && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Page markdown ({result.markdown.length} chars)</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-background border border-border max-h-64 overflow-auto whitespace-pre-wrap">{result.markdown.slice(0, 5000)}</pre>
                </details>
              )}
            </div>

            {loading && (
              <div className="absolute top-14 right-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-elegant px-3 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-fire flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold tabular-nums">~{liveCredits} credits used</div>
                  <div className="text-[10px] text-muted-foreground">
                    {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed · {CREDITS_PER_MIN} cr/min rate
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
                  <div className={`h-2 w-2 rounded-full ${j.status === "completed" ? "bg-emerald-500" : j.status === "failed" ? "bg-destructive" : "bg-amber-500"}`} />
                  <div className="flex-1 truncate font-mono text-xs">{j.input_url}</div>
                  <div className="text-xs text-muted-foreground">{(j.options?.actions?.length || 0)} actions · {j.credits_used || 0} cr</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}