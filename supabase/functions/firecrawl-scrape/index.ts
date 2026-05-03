import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const body = await req.json();
    const url: string = body.url;
    const formats = body.formats ?? ["markdown"];
    const onlyMainContent = body.onlyMainContent ?? true;
    const waitFor = body.waitFor;

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats, onlyMainContent, waitFor }),
    });

    const data = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcRes.status}`, status: fcRes.status }), {
        status: fcRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: data.data ?? data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});