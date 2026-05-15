import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy } from "lucide-react";

const SAMPLE_SCHEMA = `{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "price": { "type": "number" },
    "features": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["title"]
}`;

export default function Extract() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"schema" | "prompt">("prompt");
  const [prompt, setPrompt] = useState("Extract the main pricing tiers, features, and CTAs from this page.");
  const [schema, setSchema] = useState(SAMPLE_SCHEMA);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!url.trim()) return toast.error("Enter a URL");
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    let jsonFormat: any = { type: "json" };
    if (mode === "prompt") jsonFormat.prompt = prompt;
    else {
      try { jsonFormat.schema = JSON.parse(schema); } catch { return toast.error("Invalid JSON schema"); }
    }
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
      body: { url: normalized, formats: [jsonFormat, "markdown"], onlyMainContent: true },
    });
    setLoading(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || "Extract failed");
    setResult(data.data);
  };

  const json = result?.json || result?.extract || null;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5" /> Extract</h1>
          <p className="text-sm text-muted-foreground">LLM-powered structured extraction. Provide a schema or a prompt.</p>
        </div>
        <div className="space-y-4 border rounded-2xl p-5 bg-card">
          <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/pricing" /></div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList><TabsTrigger value="prompt">Prompt</TabsTrigger><TabsTrigger value="schema">JSON schema</TabsTrigger></TabsList>
            <TabsContent value="prompt"><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} /></TabsContent>
            <TabsContent value="schema"><Textarea value={schema} onChange={(e) => setSchema(e.target.value)} rows={10} className="font-mono text-xs" /></TabsContent>
          </Tabs>
          <Button onClick={run} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Extract
          </Button>
        </div>
        {json && (
          <div className="border rounded-2xl p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Structured output</div>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(json, null, 2)); toast.success("Copied"); }}><Copy className="h-3 w-3 mr-1" /> Copy JSON</Button>
            </div>
            <pre className="text-xs bg-muted/30 p-3 rounded-xl overflow-auto max-h-[480px]">{JSON.stringify(json, null, 2)}</pre>
          </div>
        )}
      </div>
    </AppShell>
  );
}
