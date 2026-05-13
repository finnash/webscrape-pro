import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { SnapshotKind } from "@/lib/snapshots";

export const CreateSnapshotDialog = ({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreated: () => void;
}) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SnapshotKind>("custom");
  const [description, setDescription] = useState("");
  const [paramsText, setParamsText] = useState('{\n  "keyword": ""\n}');
  const [recipeText, setRecipeText] = useState('[\n  { "tool": "search_web", "args": { "query": "{keyword}", "limit": 10 } }\n]');
  const [deliverables, setDeliverables] = useState<string>("markdown,json");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setKind("custom"); setDescription("");
    setParamsText('{\n  "keyword": ""\n}');
    setRecipeText('[\n  { "tool": "search_web", "args": { "query": "{keyword}", "limit": 10 } }\n]');
    setDeliverables("markdown,json");
  };

  const submit = async () => {
    setSaving(true);
    try {
      const params = JSON.parse(paramsText);
      const recipe = JSON.parse(recipeText);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("snapshots").insert({
        user_id: user.id,
        name: name || "Untitled snapshot",
        kind, description,
        params, recipe,
        deliverables: deliverables.split(",").map((s) => s.trim()).filter(Boolean),
      });
      if (error) throw error;
      toast({ title: "Snapshot created" });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create snapshot</DialogTitle>
          <DialogDescription>Define a reusable scrape workflow. Tokens like <code className="text-xs">{"{keyword}"}</code> in the recipe are replaced from params at run time.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Medium scraper" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SnapshotKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deliverables (comma-sep)</Label>
              <Input value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="markdown,csv,json" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does it do?" />
          </div>
          <div>
            <Label>Params (JSON)</Label>
            <Textarea value={paramsText} onChange={(e) => setParamsText(e.target.value)} className="font-mono text-xs h-24" />
          </div>
          <div>
            <Label>Recipe (JSON array of steps)</Label>
            <Textarea value={recipeText} onChange={(e) => setRecipeText(e.target.value)} className="font-mono text-xs h-32" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-gradient-fire">{saving ? "Saving…" : "Create snapshot"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};