const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC = "https://api.firecrawl.dev/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");
    const body = await req.json();
    const action: "start" | "status" = body.action || "start";

    if (action === "start") {
      const r = await fetch(`${FC}/crawl`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: body.url,
          limit: body.limit || 25,
          maxDepth: body.maxDepth,
          includePaths: body.includePaths,
          excludePaths: body.excludePaths,
          scrapeOptions: { formats: body.formats || ["markdown"], onlyMainContent: true },
        }),
      });
      const j = await r.json();
      if (!r.ok) return new Response(JSON.stringify({ success: false, error: j?.error || `Firecrawl ${r.status}` }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, data: j }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const id = body.id;
      const r = await fetch(`${FC}/crawl/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
      const j = await r.json();
      if (!r.ok) return new Response(JSON.stringify({ success: false, error: j?.error || `Firecrawl ${r.status}` }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, data: j }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
