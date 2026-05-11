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
    const url: string = body.url;
    const search: string | undefined = body.search || undefined;
    const limit: number = Math.min(Math.max(Number(body.limit) || 500, 1), 5000);
    const includeSubdomains: boolean = !!body.includeSubdomains;
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const fcRes = await fetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, search, limit, includeSubdomains }),
    });
    const data = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcRes.status}` }),
        { status: fcRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const raw = data?.links || data?.data?.links || [];
    const items = raw.map((l: any) =>
      typeof l === "string" ? { url: l } : { url: l.url, title: l.title, description: l.description }
    );
    return new Response(JSON.stringify({ success: true, links: items, count: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});