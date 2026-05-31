import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Radar, Plus, Play, Pause, Trash2, ExternalLink, Zap, Webhook, Clock, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type Monitor = {
  id: string;
  name: string;
  url: string;
  interval_minutes: number;
  discord_webhook_url: string | null;
  selector: string | null;
  keywords: string[] | null;
  enabled: boolean;
  last_checked_at: string | null;
  failure_count: number;
  created_at: string;
};

type Event = {
  id: string;
  monitor_id: string;
  kind: string;
  summary: string | null;
  matched_keywords: string[] | null;
  delivered_to_discord: boolean;
  created_at: string;
};

export default function MonitorPage() {
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<Monitor[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    url: "",
    interval_minutes: 60,
    discord_webhook_url: "",
    selector: "",
    keywords: "",
  });

  const load = async () => {
    const { data: m } = await supabase.from("monitors").select("*").order("created_at", { ascending: false });
    const { data: e } = await supabase.from("monitor_events").select("*").order("created_at", { ascending: false }).limit(50);
    setMonitors((m ?? []) as Monitor[]);
    setEvents((e ?? []) as Event[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("monitor-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "monitor_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "monitors" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async () => {
    if (!form.name || !form.url) {
      toast({ title: "Name and URL required", variant: "destructive" });
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("monitors").insert({
      user_id: u.user.id,
      name: form.name,
      url: form.url,
      interval_minutes: Math.max(5, Number(form.interval_minutes) || 60),
      discord_webhook_url: form.discord_webhook_url || null,
      selector: form.selector || null,
      keywords: form.keywords ? form.keywords.split(",").map((s) => s.trim()).filter(Boolean) : null,
    });
    if (error) {
      toast({ title: "Failed to create monitor", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Monitor created", description: "First check runs within a minute." });
    setOpen(false);
    setForm({ name: "", url: "", interval_minutes: 60, discord_webhook_url: "", selector: "", keywords: "" });
    load();
  };

  const runNow = async (m: Monitor) => {
    setBusy(m.id);
    const { error } = await supabase.functions.invoke("monitor-tick", { body: { monitor_id: m.id } });
    setBusy(null);
    if (error) toast({ title: "Run failed", description: error.message, variant: "destructive" });
    else toast({ title: "Check complete", description: `Re-scanned ${m.name}` });
    load();
  };

  const toggle = async (m: Monitor) => {
    await supabase.from("monitors").update({ enabled: !m.enabled }).eq("id", m.id);
    load();
  };

  const remove = async (m: Monitor) => {
    await supabase.from("monitors").delete().eq("id", m.id);
    load();
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-inset ring-primary/30 flex items-center justify-center text-primary">
                <Radar className="h-5 w-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Monitor</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Watch any page on a schedule. We diff the content, match your keywords, and ping your Discord the second something moves.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-fire text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> New monitor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create monitor</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OpenAI blog" /></Field>
                <Field label="URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://openai.com/blog" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Interval (min)"><Input type="number" min={5} value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: Number(e.target.value) })} /></Field>
                  <Field label="CSS selector (optional)"><Input value={form.selector} onChange={(e) => setForm({ ...form, selector: e.target.value })} placeholder="main, article" /></Field>
                </div>
                <Field label="Keywords (comma separated, optional)">
                  <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="gpt-5, launch, release" />
                </Field>
                <Field label="Discord webhook URL (optional)">
                  <Textarea rows={2} value={form.discord_webhook_url} onChange={(e) => setForm({ ...form, discord_webhook_url: e.target.value })} placeholder="https://discord.com/api/webhooks/..." />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} className="bg-gradient-fire text-primary-foreground">Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {monitors === null ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-32" /><Skeleton className="h-32" />
          </div>
        ) : monitors.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <Radar className="h-10 w-10 mx-auto text-primary mb-3" />
            <div className="font-semibold mb-1">No monitors yet</div>
            <div className="text-sm text-muted-foreground mb-4">Pick a page worth watching — a launch blog, a news feed, a docs page — and we'll ping you the moment it changes.</div>
            <Button onClick={() => setOpen(true)} className="bg-gradient-fire text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Create your first monitor</Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 mb-10">
            {monitors.map((m) => (
              <Card key={m.id} className="p-5 hover:border-primary/40 transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2">
                      {m.name}
                      {m.enabled ? <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/20">live</Badge> : <Badge variant="outline">paused</Badge>}
                    </div>
                    <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate max-w-full">
                      {m.url} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <Switch checked={m.enabled} onCheckedChange={() => toggle(m)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> every {m.interval_minutes}m</span>
                  {m.discord_webhook_url && <span className="inline-flex items-center gap-1 text-primary"><Webhook className="h-3 w-3" /> Discord</span>}
                  {m.keywords && m.keywords.length > 0 && <span className="inline-flex items-center gap-1"><Bell className="h-3 w-3" /> {m.keywords.length} keywords</span>}
                  <span>{m.last_checked_at ? `checked ${formatDistanceToNow(new Date(m.last_checked_at))} ago` : "never checked"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => runNow(m)} disabled={busy === m.id}>
                    <Zap className="h-3.5 w-3.5 mr-1" /> {busy === m.id ? "Running…" : "Run now"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(m)}>
                    {m.enabled ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} className="ml-auto text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent events</h2>
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center">
              No changes detected yet. Events show up here the moment a monitor pounces.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const m = monitors?.find((x) => x.id === e.monitor_id);
                return (
                  <Card key={e.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={e.kind === "change" ? "default" : e.kind === "error" ? "destructive" : "secondary"} className={e.kind === "change" ? "bg-primary text-primary-foreground" : ""}>{e.kind}</Badge>
                        <span className="font-medium text-sm">{m?.name ?? "Unknown monitor"}</span>
                        {e.delivered_to_discord && <span className="text-[10px] text-primary inline-flex items-center gap-1"><Webhook className="h-3 w-3" /> sent</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.created_at))} ago</span>
                    </div>
                    {e.summary && <div className="text-sm text-muted-foreground">{e.summary}</div>}
                    {e.matched_keywords && e.matched_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.matched_keywords.map((k) => (
                          <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);