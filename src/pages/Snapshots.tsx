import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SnapshotCard } from "@/components/snapshots/SnapshotCard";
import { CreateSnapshotDialog } from "@/components/snapshots/CreateSnapshotDialog";
import { BUILTIN_SNAPSHOTS, findBuiltin, type SnapshotDef } from "@/lib/snapshots";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DbSnapshot = {
  id: string; name: string; kind: any; description: string | null;
  params: any; recipe: any; deliverables: string[]; created_at: string;
};

export default function Snapshots() {
  const [createOpen, setCreateOpen] = useState(false);
  const [running, setRunning] = useState<{ name: string; recipe: any; estimate?: number } | null>(null);
  const [userSnapshots, setUserSnapshots] = useState<DbSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("snapshots").select("*").order("created_at", { ascending: false });
    setUserSnapshots((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const runBuiltin = (s: SnapshotDef) => {
    setRunning({ name: s.name, recipe: s.recipe, estimate: s.estimatedCredits({}) });
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
                    onRun={() => setRunning({ name: s.name, recipe: s.recipe })}
                  />
                  <button onClick={() => remove(s.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateSnapshotDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />

      <Dialog open={!!running} onOpenChange={(o) => !o && setRunning(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{running?.name}</DialogTitle>
            <DialogDescription>
              Execution engine ships in the next phase. Below is the exact recipe the agent will execute.
              {running?.estimate != null && <span className="block mt-1 text-foreground">Estimated cost: ~{running.estimate} credits.</span>}
            </DialogDescription>
          </DialogHeader>
          <pre className="text-[10px] bg-muted/40 p-3 rounded-lg max-h-80 overflow-auto">{JSON.stringify(running?.recipe, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}