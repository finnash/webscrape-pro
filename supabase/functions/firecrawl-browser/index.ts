const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// A "browser session" in Firecrawl Pro = one Firecrawl /scrape call with a list of
// page actions (click / write / scroll / wait) that drive a real headless browser
// and return screenshots + final markdown. This is the foundation for both manual
// and agent-driven browser control.
type Action =
  | { type: "wait"; milliseconds: number }
  | { type: "click"; selector: string }
  | { type: "write"; text: string }
  | { type: "press"; key: string }
  | { type: "scroll"; direction?: "up" | "down" }
  | { type: "screenshot"; fullPage?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const body = await req.json();
    const url: string = body.url;
    const actions: Action[] = Array.isArray(body.actions) ? body.actions : [];
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: "url is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always end with a screenshot so the user can see the final state.
    const finalActions = actions.length === 0 || actions[actions.length - 1].type !== "screenshot"
      ? [...actions, { type: "screenshot", fullPage: true } as Action]
      : actions;

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "screenshot", "links"],
        onlyMainContent: false,
        actions: finalActions,
      }),
    });
    const data = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcRes.status}` }), {
        status: fcRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, data: data.data ?? data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});