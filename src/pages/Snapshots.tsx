import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SnapshotCard } from "@/components/snapshots/SnapshotCard";
import { CreateSnapshotDialog } from "@/components/snapshots/CreateSnapshotDialog";
import { RunDrawer } from "@/components/snapshots/RunDrawer";
import { BUILTIN_SNAPSHOTS, type SnapshotDef } from "@/lib/snapshots";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Trash2, History, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DbSnapshot = {
  id: string; name: string; kind: any; description: string | null;
  params: any; recipe: any; deliverables: string[]; created_at: string;
};

type DbRun = {
  id: string; name: string | null; status: string; kind: string | null;
  created_at: string; finished_at: string | null;
};

export default function Snapshots() {
  const [createOpen, setCreateOpen] = useState(false);
  const [paramDialog, setParamDialog] = useState<{ def: SnapshotDef; values: Record<string, any> } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userSnapshots, setUserSnapshots] = useState<DbSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<DbRun[]>([]);

  const refresh = async () => {
    setLoading(true);
    const [{ data: snaps }, { data: runRows }] = await Promise.all([
      supabase.from("snapshots").select("*").order("created_at", { ascending: false }),
      supabase.from("snapshot_runs").select("id,name,status,kind,created_at,finished_at").order("created_at", { ascending: false }).limit(25),
    ]);
    setUserSnapshots((snaps as any) || []);
    setRuns((runRows as any) || []);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const ch = supabase.channel("snapshot_runs_list")
      .on("postgres_changes", { event: "*", schema: "public", table: "snapshot_runs" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runBuiltin = (s: SnapshotDef) => {
    const defaults: Record<string, any> = {};
    for (const p of s.paramsSchema) defaults[p.key] = p.default ?? "";
    setParamDialog({ def: s, values: defaults });
  };

  const runUser = async (s: DbSnapshot) => {
    await launchRun({ name: s.name, kind: s.kind, recipe: s.recipe, params: s.params || {}, snapshotId: s.id });
  };

  const launchRun = async (body: { name: string; kind: string; recipe: any; params: Record<string, any>; snapshotId?: string }) => {
    const { data, error } = await supabase.functions.invoke("snapshot-run", { body });
    if (error || !data?.runId) {
      toast({ title: "Run failed", description: error?.message || "Could not start run", variant: "destructive" });
      return;
    }
    setActiveRunId(data.runId);
    setDrawerOpen(true);
    toast({ title: "Snapshot running", description: "Live progress is streaming." });
  };

  const submitParams = async () => {
    if (!paramDialog) return;
    const { def, values } = paramDialog;
    setParamDialog(null);
    await launchRun({ name: def.name, kind: def.kind, recipe: def.recipe, params: values });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete snapshot?")) return;
    await supabase.from("snapshots").delete().eq("id", id);
    setUserSnapshots((s) => s.filter((x) => x.id !== id));
    toast({ title: "Snapshot deleted" });
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-fire flex items-center justify-center">
                <Camera className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-semibold">Snapshots</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Repeatable, agent-orchestrated scrape workflows. One click runs a chain of search → scrape → summarize and emits MD / CSV / JSON deliverables.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-gradient-fire">
            <Plus className="h-4 w-4 mr-1" /> Create snapshot
          </Button>
        </header>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Starter pack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILTIN_SNAPSHOTS.map((s) => (
              <SnapshotCard
                key={s.id}
                name={s.name}
                kind={s.kind}
                description={s.description}
                badge="Built-in"
                estimatedCredits={s.estimatedCredits({})}
                onRun={() => runBuiltin(s)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Your snapshots</h2>
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
            </div>
          )}
          {!loading && userSnapshots.length === 0 && (
            <div className="border border-dashed border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No custom snapshots yet. Hit <span className="text-foreground font-medium">Create snapshot</span> to define your own workflow.
            </div>
          )}
          {!loading && userSnapshots.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userSnapshots.map((s) => (
                <div key={s.id} className="relative">
                  <SnapshotCard
                    name={s.name}
                    kind={s.kind}
                    description={s.description || "—"}
                    onRun={() => runUser(s)}
                  />
                  <button onClick={() => remove(s.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><History className="h-3 w-3" /> Run history</h2>
          {runs.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">No runs yet. Click Run on any snapshot above.</div>
          ) : (
            <div className="border rounded-2xl divide-y">
              {runs.map((r) => {
                const Icon = r.status === "running" ? Loader2 : r.status === "succeeded" ? CheckCircle2 : r.status === "failed" ? XCircle : Loader2;
                const color = r.status === "succeeded" ? "text-emerald-500" : r.status === "failed" ? "text-destructive" : r.status === "running" ? "text-primary" : "text-muted-foreground";
                return (
                  <button key={r.id} onClick={() => { setActiveRunId(r.id); setDrawerOpen(true); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
                    <Icon className={`h-4 w-4 ${color} ${r.status === "running" ? "animate-spin" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.name || "Snapshot"}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.kind || "custom"}</div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider ${color}`}>{r.status}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <CreateSnapshotDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <RunDrawer runId={activeRunId} open={drawerOpen} onOpenChange={setDrawerOpen} />

      <Dialog open={!!paramDialog} onOpenChange={(o) => !o && setParamDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{paramDialog?.def.name}</DialogTitle>
            <DialogDescription>{paramDialog?.def.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {paramDialog?.def.paramsSchema.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs">{p.label}{p.required && <span className="text-destructive"> *</span>}</Label>
                <Input
                  type={p.type === "number" ? "number" : "text"}
                  placeholder={p.placeholder}
                  value={paramDialog.values[p.key] ?? ""}
                  onChange={(e) => setParamDialog((d) => d ? ({ ...d, values: { ...d.values, [p.key]: p.type === "number" ? Number(e.target.value) : e.target.value } }) : d)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setParamDialog(null)}>Cancel</Button>
            <Button onClick={submitParams} className="bg-gradient-fire">Run snapshot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}