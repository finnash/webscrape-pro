# Firecrawl Pro — Advanced Usage & Test Plan

_How to drive this app harder than the official Firecrawl playground, with a 20-test progression you can run by hand._

---

## 1. Why this beats firecrawl.dev

- **Private per-user history** — every Scrape, Search, Map, and AI chat is RLS-scoped to your account. Reload, switch device, come back later — it's all there.
- **Live credit HUD** — the Browser shows accurate per-minute Interact cost + the 2-credit launch fee in real time. The official playground doesn't.
- **AI orchestration** — Gemini 3 Flash with three tools (`scrape_url`, `search_web`, `map_site`) chains scraping steps for you. Threads are saved per user and resumable.
- **Presets + recents** — LLM-ready / SEO audit / Archive presets and a recent-URL chip row remove friction for repeat work.
- **Persistent Browser** — manual click-through of any site, with optional scripted action chain replay, in the same session.

---

## 2. Pro prompting playbook

### Scrape page
- ✅ Good: paste an exact URL, pick **LLM-ready preset** for clean markdown + summary, enable **mobile** for SPA/JS-heavy pages.
- ❌ Bad: pasting a search query into the URL field (use Search instead).
- Pro tip: set `waitFor=2000ms` for sites that hydrate slowly (Notion, Linear, Vercel marketing).

### Search page
- ✅ Good: short noun-phrase queries with country/lang filters and `time=year`.
- ❌ Bad: full sentences with punctuation.
- Pro tip: tick "scrape each result" only when you actually need bodies — it 5×s the cost.

### Map page
- ✅ Good: enter the bare domain, set `limit=200`, server-side `search` to narrow (`pricing`, `docs`).
- ❌ Bad: leaving limit unset on huge sites (>10k URLs).

### AI Assistant (full page or dock)
- ✅ Good: imperative, single-goal prompts. _"Scrape lovable.dev/blog and summarize the latest post in 5 bullets."_
- ✅ Good: chained: _"Map firecrawl.dev, pick the 5 most pricing-related URLs, scrape each, then give me a comparison table."_
- ❌ Bad: _"Tell me about firecrawl"_ — the model will guess instead of using tools. Always include a URL or "search the web for…".
- Pro tip: open the tool-call accordion to see exact tool inputs/outputs — useful for debugging or learning Firecrawl's API.

---

## 3. Advanced techniques

### Chaining workflow
1. **Map** the site to discover URLs.
2. Filter the URL list (use the search box).
3. Send the top 5-10 URLs to the **Assistant**: _"Scrape each of these URLs and summarize."_
4. Export the resulting markdown via the chat copy button.

### Stealth / SPA
- Mobile viewport + `waitFor: 3000` defeats most lazy-loaded content.
- For login walls / cookie banners, use **Browser** with a scripted action chain: `wait 1s → click '#accept-cookies' → wait 500ms → scroll bottom → screenshot`.

### SEO audit
- Use the **SEO audit preset** on Scrape — gives links + meta + screenshot in one job. Combine with Map to audit an entire site.

### Cost control
- Prefer `summary` over `markdown` when you only need the gist.
- Skip `screenshot` for headless pipelines.
- Reuse the same Browser session — launch fee is paid once, then 2 cr/min.
- Threads in the Assistant are free to reopen; only new messages spend AI tokens.

---

## 4. Reliability checklist (run before a big batch)

1. ✅ Logged in and your email matches `signup_allowlist`.
2. ✅ Lovable Cloud backend `cloud_status` is `ACTIVE_HEALTHY`.
3. ✅ Firecrawl credit balance > planned spend (check sidebar).
4. ✅ URL normalised (https://, no trailing query you don't need).
5. ✅ Network tab clean — no 401s.
6. ✅ Browser session not orphaned from a previous run (use Stop).
7. ✅ Output format selected matches what you'll consume.
8. ✅ Job appears in `/jobs` after submit.
9. ✅ Theme & viewport set (some sites render differently mobile vs desktop).
10. ✅ For Assistant, conversation thread chosen (not "New chat" if you want to continue context).

---

## 5. The 20-test progression

Each test: **Goal · Steps · Expected · Pass criteria.** Work top-to-bottom.

### Set 1 — Beginner (sanity)

**T1. First scrape**
- Goal: confirm Scrape works.
- Steps: open `/scrape` → paste `https://example.com` → click **Scrape**.
- Expected: markdown returned in <5s, job appears in `/jobs`.
- Pass: copy button works, credits incremented.

**T2. First search**
- Goal: confirm Search works.
- Steps: `/search` → query `firecrawl` → run.
- Expected: 10 results in ~2s.
- Pass: at least 5 unique domains shown.

**T3. View jobs**
- Goal: history persists.
- Steps: open `/jobs` → click the scrape from T1.
- Expected: dialog opens with download/copy.
- Pass: download yields the same markdown.

**T4. Download MD**
- Goal: export.
- Steps: from T1 result, download as `.md`.
- Expected: file saved with H1.
- Pass: opens cleanly in any markdown viewer.

**T5. Run Assistant once**
- Goal: AI dock works.
- Steps: click the floating sparkle bottom-right → ask `Scrape https://example.com and summarize`.
- Expected: tool-call card shows `scrape_url` → done; assistant streams a summary with shimmer effect.
- Pass: summary cites example.com.

### Set 2 — Intermediate

**T6. Search + scrape per result**
- Steps: `/search` → query `vector database 2026` → enable per-result scrape → limit 5.
- Pass: 5 markdown bodies returned, ≤ 15s.

**T7. Mobile viewport scrape**
- Steps: `/scrape` → URL of any SPA (e.g. `https://linear.app`) → toggle Mobile → scrape.
- Pass: markdown contains hero copy actually present in mobile view.

**T8. Map a site**
- Steps: `/map` → `https://firecrawl.dev` → limit 100.
- Pass: ≥ 50 URLs listed, CSV export works.

**T9. Recent URLs chip**
- Steps: scrape 3 different URLs → reload → check Scrape page.
- Pass: 3 chips visible, click refills the input.

### Set 3 — Advanced

**T10. Browser scripted chain**
- Steps: `/browser` → URL `https://news.ycombinator.com` → action: `wait 1000` → `click 'a.storylink'` → `wait 1500` → `scrape`.
- Pass: the linked story body returned, credit HUD shows ≥ 2 cr.

**T11. Multi-format scrape**
- Steps: scrape any URL with markdown + html + links + screenshot all checked.
- Pass: tabs render all four; PNG renders.

**T12. Assistant chained tool call**
- Steps: open `/assistant` → ask: `Map firecrawl.dev, pick 3 docs URLs, scrape each, then summarize what Firecrawl is in 5 bullets.`
- Pass: see ≥ 4 tool-call cards (1 map + 3 scrape) before the markdown answer.

**T13. Export CSV + JSON from Search**
- Steps: run any search → export both formats.
- Pass: CSV opens in Excel/Numbers; JSON valid (`jq .` parses).

### Set 4 — Pro

**T14. Long-form summarization**
- Steps: assistant: `Scrape https://en.wikipedia.org/wiki/Web_scraping and give me a 200-word executive summary.`
- Pass: summary < 230 words, no fabricated facts.

**T15. SEO audit preset**
- Steps: Scrape page → click **SEO audit** preset → run on your own site.
- Pass: result includes meta description, links list, and screenshot.

**T16. Concurrent jobs**
- Steps: open 3 tabs → kick off 3 different scrapes simultaneously.
- Pass: all three complete; jobs page shows 3 distinct rows.

**T17. Credit HUD verification**
- Steps: Browser session, leave open for ~3 minutes idle.
- Pass: HUD shows ~ 2 (launch) + 2 cr × 3 min ≈ 8 credits.

### Set 5 — Expert

**T18. Multi-thread chat reload**
- Steps: `/assistant` → create 3 separate threads, send a unique message in each → hard refresh.
- Pass: all 3 threads visible in left rail with their first message intact; clicking restores the full transcript and tool-call cards.

**T19. Persistent Browser re-entry**
- Steps: launch Browser session → click around manually → leave page → return.
- Pass: same session resumes, no re-launch fee re-charged.

**T20. End-to-end research**
- Steps: assistant: `Search the web for the top 3 open-source web scrapers in 2026, then scrape each project's homepage, then give me a comparison table with Stars, License, and Language.`
- Pass: ≥ 4 tool calls (1 search + 3 scrape), final answer is a markdown table with all 3 rows filled. Latency < 30s.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Scrape returns empty markdown | JS-heavy SPA | Toggle Mobile + `waitFor=3000` |
| 401 in network tab | Session expired | Sign out / sign in |
| Assistant says "I'd need to scrape that" | Forgot to include a URL | Include explicit URL in prompt |
| Browser HUD stuck | Session orphaned | Click **Stop** then **Refresh** |
| Map returns 0 URLs | `robots.txt` blocks | Try with subdomains enabled |
| AI thread not in sidebar | New thread not yet sent its first message | Send any message; thread saves on first response |
| 429 from gateway | Lovable AI rate limit | Wait ~30s, retry |
| 402 from gateway | Workspace credits exhausted | Top up in Settings → Workspace → Usage |

---

_Last updated: v0.7 — May 12, 2026._