const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const body = await req.json();
    const query: string = body.query;
    const limit: number = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
    const lang: string | undefined = body.lang || undefined;
    const country: string | undefined = body.country || undefined;
    const tbs: string | undefined = body.tbs || undefined;
    const scrapeResults: boolean = !!body.scrapeResults;
    const formats: string[] = Array.isArray(body.formats) && body.formats.length ? body.formats : ["markdown"];

    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ success: false, error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = { query, limit };
    if (lang) payload.lang = lang;
    if (country) payload.country = country;
    if (tbs) payload.tbs = tbs;
    if (scrapeResults) payload.scrapeOptions = { formats, onlyMainContent: true };

    const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcRes.status}`, status: fcRes.status }), {
        status: fcRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize: v2 may return { data: { web: [...] } } or { data: [...] } or { web: [...] }
    const root = data?.data ?? data;
    const results: any[] = Array.isArray(root) ? root : (root?.web ?? root?.results ?? []);

    return new Response(JSON.stringify({ success: true, results, raw: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});