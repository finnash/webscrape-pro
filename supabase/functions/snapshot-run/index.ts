import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC = "https://api.firecrawl.dev/v2";

type Step =
  | { tool: "search_web"; args: { query: string; limit?: number } }
  | { tool: "scrape_url"; args: { url: string | "$each"; formats?: string[] } }
  | { tool: "map_site"; args: { url: string; search?: string; limit?: number } }
  | { tool: "summarize"; args: { instruction: string } };

async function fc(path: string, body: unknown) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return { ok: false, error: "FIRECRAWL_API_KEY not configured" };
  try {
    const r = await fetch(`${FC}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j?.error || `Firecrawl ${r.status}` };
    return { ok: true, data: j?.data ?? j };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function interpolate(s: string, params: Record<string, any>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "subredditPath") return params.subreddit ? `/r/${params.subreddit}` : "";
    return params[k] != null ? String(params[k]) : "";
  });
}

function paywalled(md: string | undefined) {
  if (!md) return true;
  if (md.length < 600) return true;
  return /member-only story|paywall|subscribe to read|sign in to continue/i.test(md);
}

async function archiveFallback(url: string) {
  // Try Wayback Machine snapshot for paywalled / blocked pages.
  try {
    const av = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
    const j = await av.json().catch(() => null);
    const snap = j?.archived_snapshots?.closest?.url;
    if (!snap) return null;
    const r = await fc("/scrape", { url: snap, formats: ["markdown"], onlyMainContent: true });
    if (!r.ok) return null;
    return { markdown: r.data?.markdown, metadata: r.data?.metadata, viaArchive: snap };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const { name, kind, recipe, params, snapshotId } = body || {};
    if (!Array.isArray(recipe) || recipe.length === 0) {
      return new Response(JSON.stringify({ error: "recipe required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Service-role client for background writes (no user JWT after function returns).
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: run, error: insErr } = await admin.from("snapshot_runs").insert({
      user_id: userId, snapshot_id: snapshotId || null,
      name: name || "Snapshot", kind: kind || "custom",
      params: params || {}, recipe, status: "running",
      progress: [{ at: new Date().toISOString(), level: "info", msg: "Run queued" }],
      started_at: new Date().toISOString(),
    }).select("id").single();
    if (insErr || !run) return new Response(JSON.stringify({ error: insErr?.message || "insert failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const runId = run.id;

    const log = async (level: "info" | "warn" | "error", msg: string, data?: any) => {
      const entry = { at: new Date().toISOString(), level, msg, ...(data ? { data } : {}) };
      const { data: cur } = await admin.from("snapshot_runs").select("progress").eq("id", runId).single();
      const prog = Array.isArray(cur?.progress) ? cur!.progress : [];
      prog.push(entry);
      await admin.from("snapshot_runs").update({ progress: prog }).eq("id", runId);
    };

    const work = async () => {
      try {
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");
        let lastResults: any[] = [];
        const items: any[] = []; // accumulated scrape items
        let summary: any = null;

        for (let i = 0; i < recipe.length; i++) {
          const step = recipe[i] as Step;
          await log("info", `Step ${i + 1}/${recipe.length}: ${step.tool}`);

          if (step.tool === "search_web") {
            const q = interpolate(step.args.query, params || {});
            const limit = step.args.limit ?? 10;
            await log("info", `Searching: ${q} (limit ${limit})`);
            const r = await fc("/search", { query: q, limit });
            if (!r.ok) { await log("warn", `Search failed: ${r.error}`); continue; }
            const list = Array.isArray(r.data) ? r.data : (r.data?.web || r.data?.results || []);
            const results = list.slice(0, limit).map((x: any) => ({ title: x.title, url: x.url, description: x.description }));
            lastResults = lastResults.concat(results);
            await log("info", `Found ${results.length} results`);
          } else if (step.tool === "map_site") {
            const r = await fc("/map", { url: step.args.url, search: step.args.search, limit: step.args.limit ?? 50 });
            if (!r.ok) { await log("warn", `Map failed: ${r.error}`); continue; }
            const links = (r.data?.links || []).slice(0, step.args.limit ?? 50).map((url: string) => ({ url, title: url }));
            lastResults = lastResults.concat(links);
            await log("info", `Mapped ${links.length} URLs`);
          } else if (step.tool === "scrape_url") {
            const targets: { url: string; title?: string; description?: string }[] =
              step.args.url === "$each" ? lastResults : [{ url: String(step.args.url) }];
            const formats = step.args.formats?.length ? step.args.formats : ["markdown", "summary"];
            await log("info", `Scraping ${targets.length} URL(s)`);
            // Concurrency 3
            const queue = [...targets];
            const out: any[] = [];
            const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
              while (queue.length) {
                const t = queue.shift()!;
                try {
                  const r = await fc("/scrape", { url: t.url, formats, onlyMainContent: true });
                  let item: any;
                  if (!r.ok) { await log("warn", `Scrape failed ${t.url}: ${r.error}`); item = { url: t.url, title: t.title, error: r.error }; }
                  else item = { url: t.url, title: r.data?.metadata?.title || t.title, author: r.data?.metadata?.author, description: t.description, summary: r.data?.summary, markdown: r.data?.markdown, html: r.data?.html, links: r.data?.links, screenshot: r.data?.screenshot, metadata: r.data?.metadata };
                  if (paywalled(item.markdown) && !item.viaArchive) {
                    await log("info", `Paywall/empty for ${t.url}, trying Wayback`);
                    const av = await archiveFallback(t.url);
                    if (av && !paywalled(av.markdown)) { item = { ...item, ...av }; await log("info", `Recovered via archive`); }
                  }
                  out.push(item);
                } catch (e) {
                  await log("warn", `Scrape error ${t.url}: ${e instanceof Error ? e.message : String(e)}`);
                }
              }
            });
            await Promise.all(workers);
            items.push(...out);
            await log("info", `Scraped ${out.length} pages`);
          } else if (step.tool === "summarize") {
            if (!lovableKey) { await log("warn", "LOVABLE_API_KEY missing, skipping summarize"); continue; }
            const instruction = step.args.instruction;
            const docs = items.map((x, i) => `## [${i + 1}] ${x.title || x.url}\nURL: ${x.url}\n${(x.markdown || x.summary || "").slice(0, 2500)}`).join("\n\n---\n\n").slice(0, 60000);
            await log("info", "Summarizing with Gemini 3 Flash");
            try {
              const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk", "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    { role: "system", content: "You are a precise research analyst. Output strict markdown. Cite source URLs." },
                    { role: "user", content: `${instruction}\n\nSOURCES:\n\n${docs}` },
                  ],
                }),
              });
              const j = await r.json();
              summary = j?.choices?.[0]?.message?.content || null;
            } catch (e) { await log("warn", `Summarize failed: ${e instanceof Error ? e.message : String(e)}`); }
          }
        }

        await admin.from("snapshot_runs").update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          result: { items, summary, searchResults: lastResults },
        }).eq("id", runId);
        await log("info", `Completed: ${items.length} items`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("snapshot_runs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", runId);
        await log("error", `Run failed: ${msg}`);
      }
    };

    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(work());

    return new Response(JSON.stringify({ runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});