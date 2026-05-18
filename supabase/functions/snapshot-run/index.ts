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

// More aggressive paywall / partial-content detection.
function paywallSignals(md: string | undefined) {
  if (!md) return { paywalled: true, reason: "empty" };
  const len = md.length;
  if (len < 800) return { paywalled: true, reason: `too_short:${len}` };
  const patterns: [RegExp, string][] = [
    [/member-only story/i, "member-only"],
    [/this story is for paid members/i, "paid-members"],
    [/sign in to continue/i, "signin-wall"],
    [/subscribe to (?:read|continue|keep reading)/i, "subscribe-wall"],
    [/become a member to (?:read|access)/i, "become-member"],
    [/you have reached your free article limit/i, "metered"],
    [/upgrade to (?:medium|premium)/i, "upgrade-wall"],
    [/get (?:unlimited )?access/i, "access-wall"],
  ];
  for (const [re, tag] of patterns) if (re.test(md)) return { paywalled: true, reason: tag };
  // If body contains Read more / Continue reading near very end, likely truncated.
  const tail = md.slice(-400).toLowerCase();
  if ((/read more|continue reading/.test(tail)) && len < 2500) return { paywalled: true, reason: "truncated_tail" };
  return { paywalled: false, reason: "ok" };
}

// Try multiple archive strategies in order. Returns first usable scrape.
async function archiveCascade(url: string, log: (msg: string) => Promise<void>) {
  const candidates: { label: string; url: string }[] = [];

  const isMedium = /(?:^|\/\/)([^/]*\.)?medium\.com\//i.test(url) ||
    /\/\/[^/]+\/[^/]*@[^/]+\//.test(url); // medium custom domains use /@author/ pattern

  // For Medium: Freedium first (purpose-built bypass), then archive.ph, then Wayback.
  if (isMedium) {
    const stripped = url.replace(/^https?:\/\//, "");
    candidates.push({ label: "freedium", url: `https://freedium.cfd/${url}` });
    candidates.push({ label: "freedium-alt", url: `https://freedium.cfd/https://${stripped}` });
    candidates.push({ label: "archive-ph-newest", url: `https://archive.ph/newest/${url}` });
    candidates.push({ label: "archive-ph", url: `https://archive.ph/${url}` });
    candidates.push({ label: "12ft", url: `https://12ft.io/${url}` });
  }

  // 1. Wayback Machine "available" API => closest snapshot
  try {
    const av = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
    const j = await av.json().catch(() => null);
    const snap = j?.archived_snapshots?.closest?.url;
    if (snap) candidates.push({ label: "wayback-closest", url: snap });
  } catch {}

  // 2. Wayback latest direct (web.archive.org/web/2024*/url)
  candidates.push({ label: "wayback-latest", url: `https://web.archive.org/web/2024/${url}` });
  candidates.push({ label: "wayback-id", url: `https://web.archive.org/web/2025id_/${url}` });

  // Non-medium fallbacks (or extra attempts if medium didn't recover)
  if (!isMedium) {
    candidates.push({ label: "freedium", url: `https://freedium.cfd/${url}` });
    candidates.push({ label: "12ft", url: `https://12ft.io/${url}` });
    candidates.push({ label: "archive-ph", url: `https://archive.ph/newest/${url}` });
  }

  // De-dupe by URL while keeping order.
  const seen = new Set<string>();
  const ordered = candidates.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));

  await log(`archive cascade: ${ordered.length} candidates${isMedium ? " (medium-priority)" : ""}`);
  for (const c of ordered) {
    try {
      const r = await fc("/scrape", { url: c.url, formats: ["markdown"], onlyMainContent: true });
      if (!r.ok) { await log(`archive[${c.label}] scrape failed: ${r.error}`); continue; }
      const md = r.data?.markdown || "";
      const sig = paywallSignals(md);
      if (!sig.paywalled) {
        await log(`archive[${c.label}] ✓ recovered ${md.length} chars`);
        return { markdown: md, metadata: r.data?.metadata, viaArchive: c.url, archiveLabel: c.label };
      }
      await log(`archive[${c.label}] still paywalled: ${sig.reason} (${md.length} chars)`);
    } catch (e) {
      await log(`archive[${c.label}] exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return null;
}

// Optional LLM verifier — flags items that look like paywall snippets the regex missed.
async function verifyItemWithLLM(item: any) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return { verified: true, reason: "no-llm" };
  const md = (item.markdown || "").slice(0, 4000);
  if (!md) return { verified: false, reason: "empty" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": lovableKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You judge whether scraped article markdown is the FULL article body or a truncated paywall/login snippet. Reply with strict JSON: {\"full\": boolean, \"reason\": string}. full=true means the body is substantive and not gated." },
          { role: "user", content: `URL: ${item.url}\nFirst 4000 chars:\n${md}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(txt);
    return { verified: !!parsed.full, reason: parsed.reason || "" };
  } catch { return { verified: true, reason: "verifier-failed" }; }
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
        const items: any[] = [];
        let summary: any = null;

        for (let i = 0; i < recipe.length; i++) {
          const step = recipe[i] as Step;
          await log("info", `Step ${i + 1}/${recipe.length}: ${step.tool}`);

          if (step.tool === "search_web") {
            const rawQ = interpolate(step.args.query, params || {});
            const limit = step.args.limit ?? 10;
            // Smart query: if multi-word user keyword, also try quoted variant.
            const queries = [rawQ];
            const kw = (params?.keyword || params?.query || params?.topic || params?.niche || "").trim();
            if (kw && kw.split(/\s+/).length >= 2 && !rawQ.includes(`"${kw}"`)) {
              queries.push(rawQ.replace(kw, `"${kw}"`));
            }
            const seen = new Set<string>();
            const all: any[] = [];
            for (const q of queries) {
              await log("info", `Searching: ${q} (limit ${limit})`);
              const r = await fc("/search", { query: q, limit });
              if (!r.ok) { await log("warn", `Search failed: ${r.error}`); continue; }
              const list = Array.isArray(r.data) ? r.data : (r.data?.web || r.data?.results || []);
              for (const x of list) {
                if (!x?.url || seen.has(x.url)) continue;
                seen.add(x.url);
                all.push({ title: x.title, url: x.url, description: x.description });
                if (all.length >= limit) break;
              }
              if (all.length >= limit) break;
            }
            lastResults = lastResults.concat(all);
            await log("info", `Found ${all.length} unique results`);
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
            await log("info", `Scraping ${targets.length} URL(s) with paywall recovery + LLM verification`);
            const queue = [...targets];
            const out: any[] = [];
            const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
              while (queue.length) {
                const t = queue.shift()!;
                try {
                  const r = await fc("/scrape", { url: t.url, formats, onlyMainContent: true });
                  let item: any;
                  if (!r.ok) { await log("warn", `Scrape failed ${t.url}: ${r.error}`); item = { url: t.url, title: t.title, error: r.error, attempts: ["direct:fail"] }; }
                  else item = { url: t.url, title: r.data?.metadata?.title || t.title, author: r.data?.metadata?.author, description: t.description, summary: r.data?.summary, markdown: r.data?.markdown, html: r.data?.html, links: r.data?.links, screenshot: r.data?.screenshot, metadata: r.data?.metadata, attempts: ["direct"] };

                  // First-pass regex paywall check.
                  let sig = paywallSignals(item.markdown);
                  if (sig.paywalled) {
                    await log("warn", `Gated content on ${t.url} (${sig.reason}); cascading archives`);
                    const av = await archiveCascade(t.url, (m) => log("info", m));
                    if (av) { item = { ...item, ...av }; item.attempts.push(`archive:${av.archiveLabel}`); sig = paywallSignals(item.markdown); }
                  }

                  // Second-pass LLM verifier on borderline cases.
                  if (!sig.paywalled && (item.markdown?.length || 0) < 4000) {
                    const v = await verifyItemWithLLM(item);
                    item.verified = v.verified;
                    item.verifierReason = v.reason;
                    if (!v.verified) {
                      await log("warn", `LLM verifier rejected ${t.url} (${v.reason}); retrying archive cascade`);
                      const av = await archiveCascade(t.url, (m) => log("info", m));
                      if (av) { item = { ...item, ...av }; item.attempts.push(`archive2:${av.archiveLabel}`); item.verified = true; }
                    }
                  } else {
                    item.verified = !sig.paywalled;
                  }

                  out.push(item);
                } catch (e) {
                  await log("warn", `Scrape error ${t.url}: ${e instanceof Error ? e.message : String(e)}`);
                }
              }
            });
            await Promise.all(workers);
            items.push(...out);
            const ok = out.filter((x) => x.verified).length;
            await log("info", `Scraped ${out.length} pages · ${ok} verified full · ${out.length - ok} partial`);
          } else if (step.tool === "summarize") {
            if (!lovableKey) { await log("warn", "LOVABLE_API_KEY missing, skipping summarize"); continue; }
            const instruction = step.args.instruction;
            // Prefer verified items for the summary.
            const docs = items
              .filter((x) => x.verified !== false)
              .map((x, i) => `## [${i + 1}] ${x.title || x.url}\nURL: ${x.url}\n${(x.markdown || x.summary || "").slice(0, 3000)}`)
              .join("\n\n---\n\n").slice(0, 80000);
            await log("info", "Summarizing with Gemini 3 Flash");
            try {
              const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Lovable-API-Key": lovableKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-3-flash-preview",
                  messages: [
                    { role: "system", content: "You are a precise research analyst. Output strict markdown with clear ## headings, bullet takeaways, blockquoted highlights, and a 'Top 5 must-reads' ranked list at the end. Cite source URLs inline." },
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
        const verifiedCount = items.filter((x) => x.verified).length;
        await log("info", `Completed: ${items.length} items (${verifiedCount} verified full)`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin.from("snapshot_runs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", runId);
        await log("error", `Run failed: ${msg}`);
      }
    };

    // @ts-ignore EdgeRuntime
    EdgeRuntime.waitUntil(work());

    return new Response(JSON.stringify({ runId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
