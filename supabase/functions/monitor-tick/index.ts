import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC = "https://api.firecrawl.dev/v2";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function diffLines(oldStr: string, newStr: string, max = 40): string {
  const o = new Set(oldStr.split("\n").map((x) => x.trim()).filter(Boolean));
  const added: string[] = [];
  for (const line of newStr.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (!o.has(t)) added.push(t);
    if (added.length >= max) break;
  }
  return added.join("\n");
}

async function postDiscord(webhook: string, monitorName: string, url: string, diff: string, matched: string[]) {
  const truncated = diff.length > 1500 ? diff.slice(0, 1500) + "\n…(truncated)" : diff;
  const embed = {
    title: `🐾 ${monitorName} changed`,
    url,
    color: 0x14d2c2,
    description: truncated || "(no readable diff)",
    fields: matched.length ? [{ name: "Matched keywords", value: matched.join(", "), inline: false }] : undefined,
    footer: { text: "Meow Scraper · Monitor" },
    timestamp: new Date().toISOString(),
  };
  const r = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Meow Scraper", embeds: [embed] }),
  });
  return r.ok;
}

async function scrape(url: string, selector: string | null): Promise<{ markdown: string; title: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  const r = await fetch(`${FC}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      ...(selector ? { includeTags: [selector] } : {}),
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || `Firecrawl ${r.status}`);
  const md = j?.data?.markdown ?? j?.markdown ?? "";
  const title = j?.data?.metadata?.title ?? j?.metadata?.title ?? "";
  return { markdown: md, title };
}

async function processMonitor(supabase: any, m: any): Promise<{ status: string; detail?: string }> {
  try {
    const { markdown, title } = await scrape(m.url, m.selector);
    const normalized = markdown.replace(/\s+/g, " ").trim();
    const hash = await sha256(normalized);
    const isFirst = !m.last_hash;
    const changed = !isFirst && hash !== m.last_hash;

    if (isFirst) {
      await supabase.from("monitors").update({
        last_checked_at: new Date().toISOString(),
        last_hash: hash,
        last_snapshot: markdown.slice(0, 50000),
        failure_count: 0,
      }).eq("id", m.id);
      await supabase.from("monitor_events").insert({
        monitor_id: m.id,
        user_id: m.user_id,
        kind: "baseline",
        summary: `Baseline captured${title ? ` — ${title}` : ""} (${markdown.length} chars)`,
        snapshot: markdown.slice(0, 20000),
      });
      return { status: "baseline" };
    }

    if (!changed) {
      await supabase.from("monitors").update({
        last_checked_at: new Date().toISOString(),
        failure_count: 0,
      }).eq("id", m.id);
      return { status: "unchanged" };
    }

    const diff = diffLines(m.last_snapshot ?? "", markdown);
    const matched: string[] = [];
    if (m.keywords && Array.isArray(m.keywords)) {
      const hay = (diff + "\n" + markdown).toLowerCase();
      for (const k of m.keywords) {
        if (k && hay.includes(String(k).toLowerCase())) matched.push(k);
      }
    }

    // If keywords filter set and no match, treat as change-but-not-notable: log without Discord.
    const shouldPing = !!m.discord_webhook_url && (!m.keywords?.length || matched.length > 0);
    let delivered = false;
    if (shouldPing) {
      try { delivered = await postDiscord(m.discord_webhook_url, m.name, m.url, diff, matched); } catch (_) { delivered = false; }
    }

    await supabase.from("monitors").update({
      last_checked_at: new Date().toISOString(),
      last_hash: hash,
      last_snapshot: markdown.slice(0, 50000),
      failure_count: 0,
    }).eq("id", m.id);

    await supabase.from("monitor_events").insert({
      monitor_id: m.id,
      user_id: m.user_id,
      kind: "change",
      summary: `Detected change · ${diff.split("\n").filter(Boolean).length} new lines${matched.length ? ` · keywords: ${matched.join(", ")}` : ""}`,
      diff: diff.slice(0, 8000),
      matched_keywords: matched.length ? matched : null,
      snapshot: markdown.slice(0, 20000),
      delivered_to_discord: delivered,
    });

    return { status: "change", detail: `${matched.length} keyword matches, discord=${delivered}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("monitors").update({
      last_checked_at: new Date().toISOString(),
      failure_count: (m.failure_count ?? 0) + 1,
    }).eq("id", m.id);
    await supabase.from("monitor_events").insert({
      monitor_id: m.id,
      user_id: m.user_id,
      kind: "error",
      summary: msg.slice(0, 500),
    });
    return { status: "error", detail: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const monitorId: string | undefined = body?.monitor_id;

    if (monitorId) {
      // Single monitor: require auth header so users can only re-run their own monitor.
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: m, error } = await supabase.from("monitors").select("*").eq("id", monitorId).eq("user_id", u.user.id).maybeSingle();
      if (error || !m) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const result = await processMonitor(supabase, m);
      return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cron path: process all due monitors
    const nowIso = new Date().toISOString();
    const { data: due } = await supabase.from("monitors").select("*").eq("enabled", true);
    const toRun = (due ?? []).filter((m: any) => {
      if (!m.last_checked_at) return true;
      const last = new Date(m.last_checked_at).getTime();
      return Date.now() - last >= (m.interval_minutes || 60) * 60 * 1000;
    });
    const results: any[] = [];
    for (const m of toRun) {
      results.push({ id: m.id, name: m.name, ...(await processMonitor(supabase, m)) });
    }
    return new Response(JSON.stringify({ ok: true, ran: results.length, now: nowIso, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});