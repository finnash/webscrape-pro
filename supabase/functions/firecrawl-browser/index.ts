const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

type Action =
  | { type: "wait"; milliseconds: number }
  | { type: "click"; selector: string }
  | { type: "write"; text: string }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "up" | "down" }
  | { type: "screenshot"; fullPage?: boolean; full_page?: boolean }
  | { type: "executeJavascript"; script: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const readJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const requireApiKey = () => {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");
  return apiKey;
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const extractData = (payload: any) => payload?.data ?? payload;
const extractScrapeId = (payload: any) => {
  const data = extractData(payload);
  return data?.metadata?.scrapeId ?? data?.metadata?.scrape_id ?? data?.scrapeId ?? data?.scrape_id ?? null;
};

const firecrawl = async (path: string, apiKey: string, init: RequestInit) => {
  const res = await fetch(`${FIRECRAWL_V2}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await readJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, payload };
  }
  return { ok: true, status: res.status, payload };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = requireApiKey();
    const body = await req.json().catch(() => ({}));
    const mode = typeof body.mode === "string" ? body.mode : "actions";

    if (mode === "stop") {
      const scrapeId = typeof body.scrapeId === "string" ? body.scrapeId.trim() : "";
      if (!scrapeId) return json({ success: false, error: "scrapeId is required" }, 400);

      const stopped = await firecrawl(`/scrape/${encodeURIComponent(scrapeId)}/interact`, apiKey, { method: "DELETE" });
      if (!stopped.ok) return json({ success: false, error: stopped.payload?.error || `Firecrawl ${stopped.status}`, data: stopped.payload }, stopped.status);
      return json({ success: true, data: stopped.payload });
    }

    if (mode === "interact") {
      const scrapeId = typeof body.scrapeId === "string" ? body.scrapeId.trim() : "";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const code = typeof body.code === "string" ? body.code : "";
      const language = ["node", "python", "bash"].includes(body.language) ? body.language : "node";
      const timeout = Number.isFinite(body.timeout) ? Math.min(Math.max(Number(body.timeout), 1), 300) : 30;
      if (!scrapeId) return json({ success: false, error: "scrapeId is required" }, 400);
      if (!prompt && !code.trim()) return json({ success: false, error: "prompt or code is required" }, 400);

      const interacted = await firecrawl(`/scrape/${encodeURIComponent(scrapeId)}/interact`, apiKey, {
        method: "POST",
        body: JSON.stringify(prompt ? { prompt, timeout, origin: "firecrawl-pro" } : { code, language, timeout, origin: "firecrawl-pro" }),
      });
      if (!interacted.ok) return json({ success: false, error: interacted.payload?.error || `Firecrawl ${interacted.status}`, data: interacted.payload }, interacted.status);
      return json({ success: true, data: interacted.payload });
    }

    if (mode === "start") {
      const url = normalizeUrl(body.url);
      if (!url) return json({ success: false, error: "Valid url is required" }, 400);

      const scraped = await firecrawl("/scrape", apiKey, {
        method: "POST",
        body: JSON.stringify({
          url,
          formats: ["markdown", "screenshot"],
          onlyMainContent: false,
          waitFor: Number.isFinite(body.waitFor) ? Math.min(Math.max(Number(body.waitFor), 0), 10000) : 500,
          timeout: 60000,
          blockAds: true,
          proxy: "auto",
          profile: body.profile && typeof body.profile === "object" ? body.profile : undefined,
        }),
      });
      if (!scraped.ok) return json({ success: false, error: scraped.payload?.error || `Firecrawl ${scraped.status}`, data: scraped.payload }, scraped.status);

      const scrapeId = extractScrapeId(scraped.payload);
      if (!scrapeId) return json({ success: false, error: "Firecrawl did not return a scrapeId for live control", data: scraped.payload }, 502);

      const boot = await firecrawl(`/scrape/${encodeURIComponent(scrapeId)}/interact`, apiKey, {
        method: "POST",
        body: JSON.stringify({
          code: "await page.waitForLoadState('domcontentloaded'); await page.waitForTimeout(500); JSON.stringify({ url: page.url(), title: await page.title() });",
          language: "node",
          timeout: 15,
          origin: "firecrawl-pro-manual-browser",
        }),
      });
      if (!boot.ok) return json({ success: false, error: boot.payload?.error || `Firecrawl ${boot.status}`, data: { scrape: scraped.payload, interact: boot.payload } }, boot.status);

      const session = extractData(boot.payload);
      return json({
        success: true,
        data: {
          scrape: extractData(scraped.payload),
          scrapeId,
          liveViewUrl: session?.liveViewUrl,
          interactiveLiveViewUrl: session?.interactiveLiveViewUrl,
          session,
          billing: {
            launchScrapeCredits: 2,
            manualSessionCreditsPerMinute: 2,
            aiPromptCreditsPerMinute: 7,
            note: "Interact sessions are prorated by the second; scrape launch is billed separately.",
          },
        },
      });
    }

    const url = normalizeUrl(body.url);
    const actions: Action[] = Array.isArray(body.actions) ? body.actions : [];
    if (!url) return json({ success: false, error: "Valid url is required" }, 400);

    const finalActions = actions.length === 0 || actions[actions.length - 1].type !== "screenshot"
      ? [...actions, { type: "screenshot", fullPage: true } as Action]
      : actions;

    const scraped = await firecrawl("/scrape", apiKey, {
      method: "POST",
      body: JSON.stringify({
        url,
        formats: ["markdown", "screenshot", "links"],
        onlyMainContent: false,
        actions: finalActions,
        timeout: 120000,
        blockAds: true,
        proxy: "auto",
      }),
    });
    if (!scraped.ok) return json({ success: false, error: scraped.payload?.error || `Firecrawl ${scraped.status}`, data: scraped.payload }, scraped.status);

    return json({
      success: true,
      data: extractData(scraped.payload),
      billing: { estimatedCredits: Math.max(2, finalActions.length + 1) },
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
