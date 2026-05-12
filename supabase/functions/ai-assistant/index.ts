import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "npm:ai@5";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";
import { z } from "npm:zod@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-conversation-id",
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

    const authHeader = req.headers.get("Authorization") || "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const messages: UIMessage[] = body.messages || [];
    let conversationId: string | null = body.conversationId || null;

    // Create conversation if missing
    if (!conversationId) {
      const firstUser = messages.find((m) => m.role === "user");
      const text = (firstUser?.parts || [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join(" ")
        .slice(0, 60) || "New chat";
      const { data: conv, error: convErr } = await sb
        .from("chat_conversations")
        .insert({ user_id: userId, title: text })
        .select("id")
        .single();
      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: convErr?.message || "Failed to create conversation" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      conversationId = conv.id;
    }

    // Persist the latest user message (the last one in the array)
    const latest = messages[messages.length - 1];
    if (latest && latest.role === "user") {
      await sb.from("chat_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        parts: latest.parts as any,
      });
    }

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

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      headers: { ...corsHeaders, "x-conversation-id": conversationId! },
      onFinish: async ({ messages: finalMessages }) => {
        try {
          const assistantMsg = finalMessages[finalMessages.length - 1];
          if (assistantMsg && assistantMsg.role === "assistant") {
            await sb.from("chat_messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              parts: assistantMsg.parts as any,
            });
          }
          // Touch conversation updated_at
          await sb.from("chat_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        } catch (e) {
          console.error("persist failed", e);
        }
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});