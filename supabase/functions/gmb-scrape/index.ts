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
  websiteStatus?: "verified_none" | "present" | "unknown";
  websiteEvidence?: string;
};

const NULL_WEBSITE_RE = /^(|n\/?a|none|null|not available|no website|no website listed|website not listed|not provided|unknown|-|—)$/i;
const GOOGLE_HOST_RE = /(^|\.)google\.[a-z.]+$/i;
const GOOGLE_INTERNAL_PATH_RE = /^\/(maps|search|url|imgres|local|travel|intl|preferences|sorry|recaptcha)(\/|\?|$)/i;

const safeUrl = (value: string, base = "https://www.google.com") => {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
};

const unwrapGoogleRedirect = (raw: string) => {
  const parsed = safeUrl(raw);
  if (!parsed) return raw;
  const target = parsed.searchParams.get("q") || parsed.searchParams.get("url") || parsed.searchParams.get("u");
  return target || raw;
};

const normalizeWebsite = (value?: unknown): string | null => {
  if (typeof value !== "string") return null;
  const cleaned = unwrapGoogleRedirect(value.trim().replace(/^Website\s*[:：-]?\s*/i, ""));
  if (!cleaned || NULL_WEBSITE_RE.test(cleaned)) return null;

  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  const parsed = safeUrl(withProtocol);
  if (!parsed) return null;

  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (!hostname || GOOGLE_HOST_RE.test(hostname) || hostname.includes("gstatic") || hostname.includes("googleusercontent")) {
    return null;
  }

  return parsed.toString();
};

const isLikelyGoogleInternalLink = (raw: string) => {
  const parsed = safeUrl(raw);
  if (!parsed) return true;
  const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  return GOOGLE_HOST_RE.test(hostname) && GOOGLE_INTERNAL_PATH_RE.test(parsed.pathname);
};

const firecrawlScrape = async (apiKey: string, body: Record<string, unknown>) => {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Firecrawl ${response.status}`);
  }
  return data.data ?? data;
};

const extractPayloadLinks = (payload: any): string[] => {
  const links = payload?.links ?? payload?.data?.links ?? [];
  return Array.isArray(links) ? links.filter((link) => typeof link === "string") : [];
};

const verifyNoWebsiteOnMapsListing = async (apiKey: string, business: Business): Promise<Business | null> => {
  const directWebsite = normalizeWebsite(business.website);
  if (directWebsite) return null;

  if (!business.url) {
    return { ...business, website: "", websiteStatus: "unknown", websiteEvidence: "No Maps listing URL returned" };
  }

  const listingUrl = business.url.startsWith("http") ? business.url : `https://www.google.com/maps/search/${encodeURIComponent(business.name || "")}`;

  const schema = {
    type: "object",
    properties: {
      hasWebsiteButton: { type: "boolean" },
      websiteUrl: { type: ["string", "null"] },
      evidence: { type: "string" },
    },
    required: ["hasWebsiteButton"],
  };

  const payload = await firecrawlScrape(apiKey, {
    url: listingUrl,
    formats: [
      "links",
      {
        type: "json",
        schema,
        prompt: [
          "Inspect this individual Google Maps business listing only.",
          "Return hasWebsiteButton=true if the listing contains a Website button, official website link, or non-Google outbound business website.",
          "Return hasWebsiteButton=false only when there is clearly no Website button/link on the listing.",
          "Do not infer from web search results; use only this Maps listing page.",
        ].join(" "),
      },
    ],
    onlyMainContent: false,
    waitFor: 5000,
    location: { country: "US", languages: ["en"] },
  });

  const json = payload?.json ?? payload?.extract ?? {};
  const jsonWebsite = normalizeWebsite(json?.websiteUrl);
  const linkWebsite = extractPayloadLinks(payload)
    .map((link) => normalizeWebsite(link))
    .find((link) => link && !isLikelyGoogleInternalLink(link));

  if (json?.hasWebsiteButton === true || jsonWebsite || linkWebsite) return null;

  if (json?.hasWebsiteButton !== false) {
    return { ...business, website: "", websiteStatus: "unknown", websiteEvidence: json?.evidence || "Website status could not be verified" };
  }

  return { ...business, website: "", websiteStatus: "verified_none", websiteEvidence: json?.evidence || "No Website button found on Maps listing" };
};

const verifyNoWebsiteStrict = async (apiKey: string, candidates: Business[], limit: number) => {
  const accepted: Business[] = [];
  const rejected: Business[] = [];
  const concurrency = 4;
  let index = 0;

  const worker = async () => {
    while (index < candidates.length && accepted.length < limit) {
      const current = candidates[index++];
      try {
        const verified = await verifyNoWebsiteOnMapsListing(apiKey, current);
        if (verified?.websiteStatus === "verified_none") accepted.push(verified);
        else rejected.push(current);
      } catch {
        rejected.push(current);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));
  return { accepted: accepted.slice(0, limit), rejectedCount: rejected.length };
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

    const extractionLimit = noWebsiteOnly ? Math.min(100, Math.max(limit * 3, limit + 20)) : limit;
    const promptParts = [
      `Extract up to ${extractionLimit} business listings from this Google Maps search results page for "${query}".`,
      `For each listing capture: name, primary category, full address, phone, website URL exactly as shown (empty string if no Website button is shown), star rating, review count, opening hours snippet, and the Google Maps listing URL.`,
      noWebsiteOnly ? "Include candidates that appear to have no Website button. Accuracy matters more than quantity; uncertain listings will be verified later." : "",
      hasPhone ? "ONLY include businesses with a visible phone number." : "",
      openNow ? "Prefer businesses marked Open now." : "",
      typeof minRating === "number" ? `Only include businesses with rating >= ${minRating}.` : "",
    ].filter(Boolean).join(" ");

    const payload = await firecrawlScrape(apiKey, {
      url: mapsUrl,
      formats: [{ type: "json", schema, prompt: promptParts }],
      onlyMainContent: false,
      waitFor: 5000,
      location: { country: "US", languages: ["en"] },
    });
    const extracted: Business[] = payload?.json?.businesses ?? payload?.extract?.businesses ?? [];

    let businesses = (Array.isArray(extracted) ? extracted : []).map((business) => ({
      ...business,
      website: normalizeWebsite(business.website) || "",
    }));

    if (noWebsiteOnly) {
      businesses = businesses.filter((b) => !normalizeWebsite(b.website));
    }
    if (hasPhone) businesses = businesses.filter((b) => !!b.phone && String(b.phone).trim().length > 4);
    if (typeof minRating === "number") {
      businesses = businesses.filter((b) => typeof b.rating === "number" && b.rating >= minRating);
    }

    let rejectedWebsiteMatches = 0;
    if (noWebsiteOnly && businesses.length > 0) {
      const verified = await verifyNoWebsiteStrict(apiKey, businesses, limit);
      businesses = verified.accepted;
      rejectedWebsiteMatches = verified.rejectedCount;
    }

    businesses = businesses.slice(0, limit);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        source_url: mapsUrl,
        count: businesses.length,
        rejectedWebsiteMatches,
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