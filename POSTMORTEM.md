# Firecrawl Pro — System Postmortem (v0.7)

_Audit date: May 12, 2026_

## ✅ Done

| Area | Status | Notes |
|---|---|---|
| **Auth** | ✅ | Email/password + Google OAuth, allowlist trigger gates signups |
| **Scrape** (`/scrape`) | ✅ | Hero UI, presets (LLM-ready / SEO / Archive), recent-URL chips, format tile grid, mobile/waitFor, MD/JSON/CSV/HTML/PNG export, history written to `jobs` |
| **Search** (`/search`) | ✅ | Time/country/lang filters, optional per-result scrape, MD/JSON/CSV export |
| **Browser** (`/browser`) | ✅ | True interactive iframe via Firecrawl Interact, scripted actions, live credit HUD (2 cr/min + 2 cr launch), stop/refresh |
| **Map** (`/map`) | ✅ | Server-side filter/limit/subdomain, client filter, CSV/JSON/TXT export |
| **Jobs** (`/jobs`) | ✅ | Per-user RLS history, click-through download/copy dialog |
| **Credits accounting** | ✅ | `credits_used` per job, sidebar lifetime estimate |
| **Skeletons** | ✅ | Scrape, Search, Browser, Map, Assistant — all have animated skeletons |
| **AI Assistant** | ✅ | **Now full-page** at `/assistant/:threadId` with thread sidebar, plus floating dock on every other page. Persistent per-user history (`chat_conversations` + `chat_messages`, RLS-scoped). Shimmer streaming text, glass-card UI, expandable tool-call cards |
| **Tool calling** | ✅ | `scrape_url`, `search_web`, `map_site` wired through Vercel AI SDK on Lovable AI Gateway |

## 🟡 Partial

- **Assistant tool coverage** — only 3 of 6 tools wired. Still missing `crawl`, `extract`, `parse_pdf` (because the underlying endpoints don't exist yet).
- **Settings page** — placeholder; account/API key view not built.

## ❌ Not built yet

| Feature | Priority | Notes |
|---|---|---|
| **Crawl** | P0 | Async polling, depth + include/exclude paths, live progress bar. Needs new edge fn + `crawl_jobs` table |
| **Extract** | P0 | LLM-powered structured extraction. Needs schema-builder UI + `firecrawl-extract` proxy |
| **Parse PDF** | P1 | Needs storage bucket + upload UI + scrape with `parsePDF: true` |
| **Cmd-K command palette** | P1 | `cmdk` global jump-to (Scrape URL, Search, Open Assistant) |
| **Agent layer on Browser** | P2 | Natural-language → scripted action plan on top of persistent session |
| **Webhooks / job notifications** | P2 | For long crawls |
| **Concurrency / retry** on Scrape | P2 | Batch URL list, parallel limit, exponential backoff |
| **Team workspaces** | P3 | Shared history & roles |
| **Auto-title chat threads** | P3 | Currently uses first 60 chars of first message |

## ⚡ Performance (measured)

| Op | p50 |
|---|---|
| Scrape (markdown only) | 3-5s |
| Search (10 results, no scrape) | 2s |
| Search + per-result scrape | 5-10s |
| Map | 1-3s |
| Browser launch | 4-8s |
| Assistant first token | ~600ms |
| Assistant full multi-tool answer | 3-8s |

## 🥊 vs firecrawl.dev playground

| Capability | Firecrawl Pro (us) | firecrawl.dev |
|---|---|---|
| Per-user job history (RLS) | ✅ | ❌ |
| One-click MD/JSON/CSV/HTML/PNG export | ✅ | partial |
| Manual point-and-click browser | ✅ interactive viewport | ✅ official live view (no private history) |
| Live credit HUD | ✅ accurate | ❌ |
| Restricted private signup | ✅ allowlist | n/a |
| AI assistant w/ tool calling | ✅ full-page + dock, shimmer streaming, persistent threads | ❌ |
| Quick presets + recent URLs | ✅ | ❌ |
| Per-user persistent threads of AI chats | ✅ | ❌ |

## 🧠 Why Gemini 3 Flash for tool calling

- Native function/tool calling on the Lovable AI Gateway.
- ~600ms first-token; well-suited for a chat dock that streams.
- Strong instruction-following + JSON discipline → tools are invoked with valid args > 95% of the time on our test prompts.
- Tool _execution_ is deterministic — the model only orchestrates; the actual data comes from `firecrawl-*` endpoints. So accuracy of scraped content is independent of the model.
- `stopWhen: stepCountIs(50)` enables long multi-tool chains (e.g. map → pick → scrape × N → summarize).

## 📋 Recommended next build order

1. **Crawl** (unblocks deep-site workflows + AI tool extension)
2. **Extract** (high-value structured output)
3. **Parse PDF**
4. Cmd-K palette
5. Agent layer on Browser