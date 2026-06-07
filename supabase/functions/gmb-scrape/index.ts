import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  keyword: z.string().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  limit: z.number().int().min(1).max(100).default(20),
  noWebsiteOnly: z.boolean().optional().default(false),
  minRating: z.number().min(0).max(5).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  openNow: z.boolean().optional().default(false),
  hasPhone: z.boolean().optional().default(false),
});

type Business = {
  name?: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  url?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { keyword, location, limit, noWebsiteOnly, minRating, category, openNow, hasPhone } = parsed.data;

    const query = [keyword, category, location].filter(Boolean).join(" ");
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    const schema = {
      type: "object",
      properties: {
        businesses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              address: { type: "string" },
              phone: { type: "string" },
              website: { type: "string" },
              rating: { type: "number" },
              reviews: { type: "number" },
              hours: { type: "string" },
              url: { type: "string" },
            },
          },
        },
      },
      required: ["businesses"],
    };

    const promptParts = [
      `Extract up to ${limit} business listings from this Google Maps search results page for "${query}".`,
      `For each listing capture: name, primary category, full address, phone, website URL (null if none shown), star rating, review count, opening hours snippet, and the Google Maps listing URL.`,
      noWebsiteOnly ? "ONLY include businesses that have NO website link." : "",
      hasPhone ? "ONLY include businesses with a visible phone number." : "",
      openNow ? "Prefer businesses marked Open now." : "",
      typeof minRating === "number" ? `Only include businesses with rating >= ${minRating}.` : "",
    ].filter(Boolean).join(" ");

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: mapsUrl,
        formats: [{ type: "json", schema, prompt: promptParts }],
        onlyMainContent: false,
        waitFor: 3500,
        location: { country: "US", languages: ["en"] },
      }),
    });

    const data = await fcRes.json();
    if (!fcRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcRes.status}`, status: fcRes.status }),
        { status: fcRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = data.data ?? data;
    const extracted: Business[] = payload?.json?.businesses ?? payload?.extract?.businesses ?? [];

    let businesses = Array.isArray(extracted) ? extracted : [];

    if (noWebsiteOnly) {
      businesses = businesses.filter((b) => !b.website || /^(n\/?a|none|null)$/i.test(String(b.website).trim()));
    }
    if (hasPhone) businesses = businesses.filter((b) => !!b.phone && String(b.phone).trim().length > 4);
    if (typeof minRating === "number") {
      businesses = businesses.filter((b) => typeof b.rating === "number" && b.rating >= minRating);
    }

    businesses = businesses.slice(0, limit);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        source_url: mapsUrl,
        count: businesses.length,
        businesses,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});