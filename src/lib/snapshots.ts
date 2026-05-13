// Built-in Snapshot definitions — repeatable, agent-orchestrated scrape recipes.
// These are the "starter pack" displayed on the Snapshots page above any
// user-created snapshots. Execution engine is wired in a later phase; this
// file is the source-of-truth for shape + UI rendering.

export type SnapshotKind = "medium" | "reddit" | "leads" | "research" | "custom";

export type SnapshotStep =
  | { tool: "search_web"; args: { query: string; limit?: number } }
  | { tool: "scrape_url"; args: { url: string | "$each"; formats?: string[] } }
  | { tool: "map_site"; args: { url: string; search?: string; limit?: number } }
  | { tool: "summarize"; args: { instruction: string } };

export type SnapshotDef = {
  id: string;
  name: string;
  kind: SnapshotKind;
  description: string;
  paramsSchema: { key: string; label: string; type: "string" | "number"; required?: boolean; default?: string | number; placeholder?: string }[];
  recipe: SnapshotStep[];
  deliverables: ("markdown" | "csv" | "json" | "screenshot" | "pdf")[];
  estimatedCredits: (params: Record<string, any>) => number;
};

export const BUILTIN_SNAPSHOTS: SnapshotDef[] = [
  {
    id: "medium-blogs",
    name: "Medium Blogs by Keyword",
    kind: "medium",
    description:
      "Discover the top N Medium articles for a keyword and pull clean markdown + a CSV index (title, url, author, summary).",
    paramsSchema: [
      { key: "keyword", label: "Keyword / topic", type: "string", required: true, placeholder: "OpenFlop" },
      { key: "limit", label: "How many articles", type: "number", default: 10 },
    ],
    recipe: [
      { tool: "search_web", args: { query: "site:medium.com {keyword}", limit: 10 } },
      { tool: "scrape_url", args: { url: "$each", formats: ["markdown", "summary"] } },
      { tool: "summarize", args: { instruction: "Group by author, extract key takeaways per article, output a CSV index + a single MD bundle." } },
    ],
    deliverables: ["markdown", "csv", "json"],
    estimatedCredits: (p) => (Number(p.limit) || 10) * 2 + 1,
  },
  {
    id: "reddit-threads",
    name: "Reddit Thread Sweep",
    kind: "reddit",
    description:
      "Search Reddit (optionally a specific subreddit) for a query, scrape each thread including OP body and top comments, and emit MD + JSON.",
    paramsSchema: [
      { key: "query", label: "Search query", type: "string", required: true, placeholder: "best vector db 2026" },
      { key: "subreddit", label: "Subreddit (optional)", type: "string", placeholder: "MachineLearning" },
      { key: "limit", label: "Threads", type: "number", default: 8 },
    ],
    recipe: [
      { tool: "search_web", args: { query: "site:old.reddit.com{subredditPath} {query}", limit: 8 } },
      { tool: "scrape_url", args: { url: "$each", formats: ["markdown"] } },
      { tool: "summarize", args: { instruction: "For each thread output: title, url, OP excerpt, top 5 comments, sentiment." } },
    ],
    deliverables: ["markdown", "json"],
    estimatedCredits: (p) => (Number(p.limit) || 8) * 2 + 1,
  },
  {
    id: "leads-finder",
    name: "Leads Finder (People in Need)",
    kind: "leads",
    description:
      "Multi-source intent search — Reddit, X, Facebook groups, Craigslist, Yelp — for prospects actively asking for help in your niche. AI ranks by buying intent and outputs lead cards.",
    paramsSchema: [
      { key: "niche", label: "Niche / service you sell", type: "string", required: true, placeholder: "AI chatbot for roofers" },
      { key: "region", label: "Region", type: "string", default: "US", placeholder: "US" },
      { key: "intent", label: "Intent phrase", type: "string", default: "looking for", placeholder: "looking for / need help with" },
    ],
    recipe: [
      { tool: "search_web", args: { query: "site:reddit.com \"{intent}\" {niche} {region}", limit: 10 } },
      { tool: "search_web", args: { query: "site:facebook.com/groups \"{intent}\" {niche}", limit: 10 } },
      { tool: "search_web", args: { query: "site:craigslist.org {niche} {region}", limit: 10 } },
      { tool: "search_web", args: { query: "site:yelp.com {niche} {region}", limit: 10 } },
      { tool: "scrape_url", args: { url: "$each", formats: ["markdown", "summary"] } },
      { tool: "summarize", args: { instruction: "For each promising result emit a Lead Card: who, where, the ask, contact hint, intent score 1-10, why-fit, suggested first message." } },
    ],
    deliverables: ["markdown", "csv", "json"],
    estimatedCredits: (_) => 60,
  },
  {
    id: "research-papers",
    name: "Research Paper Pull",
    kind: "research",
    description:
      "Discover recent research papers on a topic (arXiv + Google Scholar) and extract abstract, sections, and key references into structured MD + JSON.",
    paramsSchema: [
      { key: "topic", label: "Topic", type: "string", required: true, placeholder: "retrieval augmented generation" },
      { key: "limit", label: "Papers", type: "number", default: 5 },
    ],
    recipe: [
      { tool: "search_web", args: { query: "site:arxiv.org {topic}", limit: 5 } },
      { tool: "scrape_url", args: { url: "$each", formats: ["markdown"] } },
      { tool: "summarize", args: { instruction: "Extract title, authors, abstract, contributions, methods, results, limitations, key references." } },
    ],
    deliverables: ["markdown", "json"],
    estimatedCredits: (p) => (Number(p.limit) || 5) * 2 + 1,
  },
];

export const findBuiltin = (id: string) => BUILTIN_SNAPSHOTS.find((s) => s.id === id);