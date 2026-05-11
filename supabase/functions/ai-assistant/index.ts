import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC = "https://api.firecrawl.dev/v2";

async function firecrawl(path: string, body: unknown) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const r = await fetch(`${FC}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || `Firecrawl ${r.status}`);
  return j?.data ?? j;
}

function compactMd(md: string | undefined, max = 3500) {
  if (!md) return "";
  return md.length > max ? md.slice(0, max) + "\n\n…(truncated)" : md;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages }: { messages: UIMessage[] } = await req.json();

    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });
    const model = gateway("google/gemini-3-flash-preview");

    const tools = {
      scrape_url: tool({
        description: "Scrape a single URL and return clean markdown plus metadata.",
        inputSchema: z.object({
          url: z.string().url().describe("The fully-qualified URL to scrape"),
          formats: z.array(z.enum(["markdown", "html", "links", "summary", "screenshot"])).optional(),
        }),
        execute: async ({ url, formats }) => {
          const data = await firecrawl("/scrape", {
            url,
            formats: formats?.length ? formats : ["markdown", "summary"],
            onlyMainContent: true,
          });
          return {
            url,
            title: data?.metadata?.title,
            summary: data?.summary,
            markdown: compactMd(data?.markdown),
            links: Array.isArray(data?.links) ? data.links.slice(0, 25) : undefined,
          };
        },
      }),
      search_web: tool({
        description: "Search the web and return top results (title, url, description).",
        inputSchema: z.object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(15).optional(),
        }),
        execute: async ({ query, limit }) => {
          const data = await firecrawl("/search", { query, limit: limit ?? 8 });
          const list = Array.isArray(data) ? data : (data?.web || data?.results || []);
          return {
            query,
            results: list.slice(0, limit ?? 8).map((r: any) => ({
              title: r.title, url: r.url, description: r.description,
            })),
          };
        },
      }),
      map_site: tool({
        description: "Discover URLs on a website. Useful before crawling.",
        inputSchema: z.object({
          url: z.string().url(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }),
        execute: async ({ url, search, limit }) => {
          const data = await firecrawl("/map", { url, search, limit: limit ?? 100 });
          const links = data?.links || data || [];
          return { url, count: links.length, links: links.slice(0, limit ?? 100) };
        },
      }),
    };

    const result = streamText({
      model,
      system: `You are Firecrawl Pro's in-app AI assistant. You help users scrape, search, and map the web.
- Use the provided tools for any web data — never invent URLs or content.
- Respond in concise, well-structured markdown.
- When summarizing scraped content, cite the source URL.
- For multi-step tasks (e.g. "find X then summarize"), call tools in sequence.`,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(50),
    });

    return result.toUIMessageStreamResponse({ headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});