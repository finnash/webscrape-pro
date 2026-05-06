# Firecrawl Pro — System Postmortem (v0.4)

## ✅ Working
- **Auth** — email/password + Google, signup gated by `signup_allowlist` trigger.
- **Scrape** — URL normalization, format picker, multi-format download (MD/JSON/CSV/HTML/PNG), live job history, RLS-protected.
- **Search** — `firecrawl-search` edge function, optional per-result scrape, time/country/language filters, CSV/JSON/MD export.
- **Browser** — `firecrawl-browser` edge function w/ true **interactive live view** via Firecrawl Interact, stop/refresh controls, scripted replay, and accurate live credit HUD (2 cr/min manual + 2 cr launch scrape).
- **Jobs** — clickable history with download/copy dialog.
- **Credits accounting** — per-job `credits_used` written to DB; sidebar shows lifetime estimates.

## 🟡 Stub / Coming-soon
- **Map**, **Crawl**, **Extract**, **Parse PDF** — routed to `ComingSoon` page.
- **Agents** — explicitly deferred per user; Browser is the foundation.

## ⚡ Performance
- Scrape p50: ~3–5s (Firecrawl Pro fast path).
- Search (no scrape): ~2s for 10 results. With scrape: 5–10s.
- Browser session: ~4–8s launch, then direct iframe control; scripted chains remain 4–8s for short runs.

## 🥊 vs official Firecrawl playground
| | Firecrawl Pro | firecrawl.dev |
|---|---|---|
| Per-user job history (RLS) | ✅ | ❌ |
| One-click MD/JSON/CSV/HTML/PNG export | ✅ | partial |
| Manual point-and-click browser | ✅ (interactive live viewport) | ✅ official live view, but not paired with private job history |
| Live credits HUD | ✅ accurate Interact rate + launch scrape estimate | ❌ |
| Restricted private signup | ✅ | n/a |

## 📋 Next up
1. Crawl with depth/include-paths controls + async polling.
2. Map for full-site URL graph viz.
3. Extract with Lovable AI Gateway schema builder.
4. Agent layer on top of the existing persistent manual browser session.
