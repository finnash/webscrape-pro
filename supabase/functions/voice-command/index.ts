import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GW = "https://ai.gateway.lovable.dev";
const FC = "https://api.firecrawl.dev/v2";
const MAX = 12 * 1024 * 1024;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function llm(prompt: string): Promise<string> {
  const r = await fetch(`${GW}/v1/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-6-astra", input: prompt }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || `AI ${r.status}`), { status: r.status });
  if (typeof j.output_text === "string") return j.output_text;
  return (j.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("");
}

async function fc(path: string, body: unknown) {
  const r = await fetch(`${FC}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("FIRECRAWL_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Firecrawl ${r.status}`);
  return j?.data ?? j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    if (Number(req.headers.get("content-length") ?? 0) > MAX + 512 * 1024) return json({ error: "Recording too long" }, 413);

    // 1. Get the command text (typed or spoken)
    let text = "";
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      text = String((await req.json()).text ?? "").trim();
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > MAX) return json({ error: "Invalid audio" }, 400);
      const f = new FormData();
      f.append("model", "google/gemini-3.5-transcribe");
      f.append("file", new File([file], "voice.webm", { type: "audio/webm" }));
      f.append("response_format", "json");
      const tr = await fetch(`${GW}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}` },
        body: f,
      });
      const tj = await tr.json().catch(() => ({}));
      if (!tr.ok) return json({ error: tj?.error?.message || "Transcription failed" }, tr.status);
      text = String(tj.text ?? "").trim();
    }
    if (!text) return json({ error: "Didn't catch that — try again" }, 400);

    // 2. Decide what to do
    const planRaw = await llm(
      `You route voice commands for a web scraping tool. Command: "${text}"\n` +
        `Reply ONLY with JSON: {"action":"scrape","url":"https://..."} if a website/URL is named, ` +
        `or {"action":"search","query":"..."} for research/news questions.`,
    );
    const plan = JSON.parse(planRaw.slice(planRaw.indexOf("{"), planRaw.lastIndexOf("}") + 1));

    // 3. Run it
    let source = "";
    let links: string[] = [];
    if (plan.action === "scrape" && plan.url) {
      const url = /^https?:\/\//.test(plan.url) ? plan.url : `https://${plan.url}`;
      const d = await fc("/scrape", { url, formats: ["markdown"], onlyMainContent: true });
      source = String(d.markdown ?? "").slice(0, 12000);
      links = [url];
    } else {
      const d = await fc("/search", { query: plan.query || text, limit: 5, scrapeOptions: { formats: ["markdown"] } });
      const items = (d.web ?? d ?? []) as any[];
      links = items.map((i) => i.url).filter(Boolean);
      source = items.map((i) => `## ${i.title}\n${i.url}\n${String(i.markdown ?? i.description ?? "").slice(0, 2500)}`).join("\n\n");
    }

    // 4. Summarize
    const summary = await llm(
      `User asked: "${text}". Using the content below, give a sharp answer in under 150 words with bullet points. ` +
        `No preamble.\n\n${source}`,
    );

    await sb.from("scrape_jobs").insert({
      user_id: u.user.id, kind: plan.action === "scrape" ? "scrape" : "search",
      input: { voice: text, ...plan }, status: "completed", result: { summary, links },
    }).then(() => {}, () => {});

    return json({ text, action: plan.action, summary, links });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed" }, e?.status && e.status >= 400 ? e.status : 500);
  }
});
