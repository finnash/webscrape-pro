# Firecrawl Pro — System Postmortem (v0.5)

## ✅ Working
- **Auth** — email/password + Google, signup gated by `signup_allowlist` trigger.
- **Scrape** — Redesigned UI: hero header, quick presets (LLM-ready / SEO audit / Archive), recent-URL chips, format tiles with icons, advanced (mobile viewport, waitFor ms, only-main toggle), multi-format export. Skeleton loader kept.
- **Search** — `firecrawl-search` edge function, optional per-result scrape, time/country/language filters, CSV/JSON/MD export.
- **Browser** — `firecrawl-browser` edge function w/ true **interactive live view** via Firecrawl Interact, stop/refresh controls, scripted replay, and accurate live credit HUD (2 cr/min manual + 2 cr launch scrape).
- **Map** — new endpoint `firecrawl-map`, server-side filter/limit/subdomain options, client-side filter, CSV/JSON/TXT export. Skeleton loader.
- **Jobs** — clickable history with download/copy dialog.
- **Credits accounting** — per-job `credits_used` written to DB; sidebar shows lifetime estimates.
- **AI Assistant** — floating shimmer-streaming dock on every page (`AssistantDock`), powered by Lovable AI Gateway (`google/gemini-3-flash-preview`) via Vercel AI SDK with tool calling. Tools: `scrape_url`, `search_web`, `map_site`. Premium glass-card UI, left→right shimmer text while streaming, collapsible tool-call cards.

## 🟡 Stub / Coming-soon
- **Crawl**, **Extract**, **Parse PDF** — routed to `ComingSoon` page (next batch).
- **Agents** — explicitly deferred per user; Browser is the foundation.

## ⚡ Performance
- Scrape p50: ~3–5s (Firecrawl Pro fast path).
- Search (no scrape): ~2s for 10 results. With scrape: 5–10s.
- Map: ~1–3s typical.
- Assistant: first token ~600ms, full multi-tool response 3–8s depending on tools chained.
- Browser session: ~4–8s launch, then direct iframe control; scripted chains remain 4–8s for short runs.

## 🥊 vs official Firecrawl playground
| | Firecrawl Pro | firecrawl.dev |
|---|---|---|
| Per-user job history (RLS) | ✅ | ❌ |
| One-click MD/JSON/CSV/HTML/PNG export | ✅ | partial |
| Manual point-and-click browser | ✅ (interactive live viewport) | ✅ official live view, but not paired with private job history |
| Live credits HUD | ✅ accurate Interact rate + launch scrape estimate | ❌ |
| Restricted private signup | ✅ | n/a |
| AI assistant w/ tool calling (scrape/search/map) | ✅ shimmer-streaming chat dock | ❌ |
| Quick presets + recent URLs in scraper | ✅ | ❌ |

## 📋 Next up
1. Crawl with depth/include-paths controls + async polling.
2. Extract with Lovable AI Gateway schema builder.
3. Parse PDF with file upload to storage.
4. Persist Assistant chat threads in `chat_conversations` / `chat_messages`.
5. Cmd-K command palette.
6. Agent layer on top of the existing persistent manual browser session.
