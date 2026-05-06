# Firecrawl Pro — System Postmortem (v0.4)

## ✅ Working
- **Auth** — email/password + Google, signup gated by `signup_allowlist` trigger.
- **Scrape** — URL normalization, format picker, multi-format download (MD/JSON/CSV/HTML/PNG), live job history, RLS-protected.
- **Search** — `firecrawl-search` edge function, optional per-result scrape, time/country/language filters, CSV/JSON/MD export.
- **Browser** — `firecrawl-browser` edge function w/ click/type/scroll/wait/screenshot + **manual click-to-interact** (JS coordinate replay) and **live credits HUD** (60 cr/min reference).
- **Jobs** — clickable history with download/copy dialog.
- **Credits accounting** — per-job `credits_used` written to DB; sidebar shows lifetime estimates.

## 🟡 Stub / Coming-soon
- **Map**, **Crawl**, **Extract**, **Parse PDF** — routed to `ComingSoon` page.
- **Agents** — explicitly deferred per user; Browser is the foundation.

## ⚡ Performance
- Scrape p50: ~3–5s (Firecrawl Pro fast path).
- Search (no scrape): ~2s for 10 results. With scrape: 5–10s.
- Browser session: 4–8s for 3-action chains; manual click adds ~3s replay round-trip.

## 🥊 vs official Firecrawl playground
| | Firecrawl Pro | firecrawl.dev |
|---|---|---|
| Per-user job history (RLS) | ✅ | ❌ |
| One-click MD/JSON/CSV/HTML/PNG export | ✅ | partial |
| Manual point-and-click browser | ✅ (JS replay) | ❌ |
| Live credits HUD | ✅ | ❌ |
| Restricted private signup | ✅ | n/a |

## 📋 Next up
1. Crawl with depth/include-paths controls + async polling.
2. Map for full-site URL graph viz.
3. Extract with Lovable AI Gateway schema builder.
4. Real persistent browser session (currently every manual click re-runs from URL — fine for MVP, will move to persistent Playwright session for true mouse control).
