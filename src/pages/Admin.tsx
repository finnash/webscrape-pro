import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { PLANS } from "@/lib/plans";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Loader2, Search, Coins, Ban, CheckCircle2, ShieldPlus, ShieldMinus, Trash2, Plus, Minus } from "lucide-react";

type Row = {
  user_id: string;
  display_name: string | null;
  plan: string;
  credits_remaining: number;
  daily_credit_limit: number;
  blocked_until: string | null;
  block_reason: string | null;
  created_at: string;
  email?: string;
  is_admin?: boolean;
};

export default function Admin() {
  const { isAdmin, loading } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [creditFor, setCreditFor] = useState<Row | null>(null);
  const [creditValue, setCreditValue] = useState(0);
  const [creditDelta, setCreditDelta] = useState(0);
  const [blockFor, setBlockFor] = useState<Row | null>(null);
  const [blockReason, setBlockReason] = useState("Suspended by admin");
  const [terminateFor, setTerminateFor] = useState<Row | null>(null);

  const load = async () => {
    setBusy(true);
    const sb: any = supabase;
    const { data: profs, error } = await sb.from("profiles")
      .select("user_id, display_name, plan, credits_remaining, daily_credit_limit, blocked_until, block_reason, created_at")
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); setBusy(false); return; }
    const { data: roles } = await sb.from("user_roles").select("user_id, role");
    const adminSet = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
    setRows((profs ?? []).map((p: any) => ({ ...p, is_admin: adminSet.has(p.user_id) })));
    setBusy(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <AppShell><div className="p-6 text-muted-foreground">Loading…</div></AppShell>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const setPlan = async (row: Row, slug: string) => {
    const planDef = PLANS.find((p) => p.slug === slug)!;
    const { error } = await (supabase as any).from("profiles").update({
      plan: slug,
      daily_credit_limit: planDef.dailyCredits,
      credits_remaining: planDef.dailyCredits,
    }).eq("user_id", row.user_id);
    if (error) toast.error(error.message); else { toast.success(`Moved to ${planDef.name}`); load(); }
  };

  const block30 = async () => {
    if (!blockFor) return;
    const until = new Date(); until.setDate(until.getDate() + 30);
    const { error } = await (supabase as any).from("profiles").update({
      blocked_until: until.toISOString(), block_reason: blockReason || "Suspended by admin",
    }).eq("user_id", blockFor.user_id);
    if (error) toast.error(error.message); else { toast.success("Account blocked for 30 days"); setBlockFor(null); load(); }
  };

  const unblock = async (row: Row) => {
    const { error } = await (supabase as any).from("profiles").update({ blocked_until: null, block_reason: null }).eq("user_id", row.user_id);
    if (error) toast.error(error.message); else { toast.success("Account restored"); load(); }
  };

  const saveCredits = async () => {
    if (!creditFor) return;
    const next = Math.max(0, creditValue + creditDelta);
    const { error } = await (supabase as any).from("profiles").update({ credits_remaining: next }).eq("user_id", creditFor.user_id);
    if (error) toast.error(error.message); else { toast.success("Credits updated"); setCreditFor(null); load(); }
  };

  const promoteAdmin = async (row: Row) => {
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: row.user_id, role: "admin" });
    if (error) toast.error(error.message); else { toast.success(`${row.display_name || "User"} promoted to admin`); load(); }
  };

  const demoteAdmin = async (row: Row) => {
    const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin");
    if (error) toast.error(error.message); else { toast.success("Admin role removed"); load(); }
  };

  const terminate = async () => {
    if (!terminateFor) return;
    // Permanent termination: block 100 years + zero credits + downgrade to free
    const until = new Date(); until.setFullYear(until.getFullYear() + 100);
    const { error } = await (supabase as any).from("profiles").update({
      blocked_until: until.toISOString(),
      block_reason: "Account terminated by admin",
      credits_remaining: 0,
      plan: "free",
      daily_credit_limit: 0,
    }).eq("user_id", terminateFor.user_id);
    if (error) toast.error(error.message); else { toast.success("Account terminated"); setTerminateFor(null); load(); }
  };

  const filtered = rows.filter((r) =>
    !q ||
    (r.display_name?.toLowerCase().includes(q.toLowerCase())) ||
    r.user_id.includes(q)
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage members, plans, credits and account access.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or id" className="pl-9 h-9 w-64" />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Refresh
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
            <div className="col-span-4">Member</div>
            <div className="col-span-2">Plan</div>
            <div className="col-span-2">Credits</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No members yet.</div>}
          {filtered.map((row) => {
            const blocked = row.blocked_until && new Date(row.blocked_until) > new Date();
            return (
              <div key={row.user_id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border last:border-0 items-center text-sm">
                <div className="col-span-4 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {row.display_name || "—"}
                    {row.is_admin && <Badge className="text-[9px] bg-primary text-primary-foreground">ADMIN</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-mono">{row.user_id}</div>
                </div>
                <div className="col-span-2">
                  <Select value={row.plan} onValueChange={(v) => setPlan(row, v)} disabled={row.is_admin}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-xs">
                  <span className="font-medium">{row.credits_remaining}</span>
                  <span className="text-muted-foreground"> / {row.daily_credit_limit}</span>
                </div>
                <div className="col-span-1">
                  {blocked ? (
                    <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  )}
                </div>
                <div className="col-span-3 flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => { setCreditFor(row); setCreditValue(row.credits_remaining); setCreditDelta(0); }}>
                    <Coins className="h-3.5 w-3.5 mr-1" /> Credits
                  </Button>
                  {row.is_admin ? (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => demoteAdmin(row)}>
                      <ShieldMinus className="h-3.5 w-3.5 mr-1" /> Demote
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => promoteAdmin(row)}>
                      <ShieldPlus className="h-3.5 w-3.5 mr-1" /> Promote
                    </Button>
                  )}
                  {blocked ? (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => unblock(row)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Unblock
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      className="h-8 text-destructive hover:bg-destructive/10"
                      disabled={row.is_admin}
                      onClick={() => { setBlockFor(row); setBlockReason("Suspended by admin"); }}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Block 30d
                    </Button>
                  )}
                  <Button
                    variant="outline" size="sm"
                    className="h-8 text-destructive hover:bg-destructive/10"
                    disabled={row.is_admin}
                    onClick={() => setTerminateFor(row)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Terminate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!creditFor} onOpenChange={(o) => !o && setCreditFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust credits</DialogTitle>
            <DialogDescription>Manually set the remaining daily credits for {creditFor?.display_name || "this user"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Set credits remaining today</Label>
              <Input type="number" value={creditValue} onChange={(e) => setCreditValue(Number(e.target.value))} min={0} />
            </div>
            <div className="space-y-2">
              <Label>Or add / subtract</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreditDelta((d) => d - 50)}><Minus className="h-3.5 w-3.5 mr-1" />50</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setCreditDelta((d) => d + 50)}><Plus className="h-3.5 w-3.5 mr-1" />50</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setCreditDelta((d) => d + 500)}><Plus className="h-3.5 w-3.5 mr-1" />500</Button>
                <Input type="number" value={creditDelta} onChange={(e) => setCreditDelta(Number(e.target.value))} className="h-9" />
              </div>
              <p className="text-xs text-muted-foreground">
                Final: <span className="font-medium text-foreground">{Math.max(0, creditValue + creditDelta)}</span> · Daily cap: {creditFor?.daily_credit_limit}. Resets 00:05 UTC.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditFor(null)}>Cancel</Button>
            <Button onClick={saveCredits}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!blockFor} onOpenChange={(o) => !o && setBlockFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Block for 30 days
            </DialogTitle>
            <DialogDescription>
              {blockFor?.display_name || "This user"} will see a suspension screen the next time they sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (shown to user)</Label>
            <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={block30}>Block account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!terminateFor} onOpenChange={(o) => !o && setTerminateFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Terminate account
            </DialogTitle>
            <DialogDescription>
              Permanently revokes access for {terminateFor?.display_name || "this user"}: plan reset to Free, credits zeroed, and account blocked indefinitely. You can restore later with Unblock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={terminate}>Terminate account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}