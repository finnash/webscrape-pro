
# Firecrawl Pro — Postmortem + UI/Feature Upgrade Plan

## Postmortem (top to bottom)

### What's working
- **Auth** — email/password + Google, allowlist trigger gating signups.
- **Scrape** (`/scrape` + `firecrawl-scrape` edge fn) — URL normalize, 6 formats, MD/JSON/CSV/HTML/PNG export, history saved.
- **Search** (`/search` + `firecrawl-search`) — time/country/lang filters, optional per-result scrape, MD/JSON/CSV export.
- **Browser** (`/browser` + `firecrawl-browser`) — manual interactive iframe, scripted action chain, live credit HUD, stop/refresh.
- **Jobs** — RLS history with download dialog.
- **Credits** — per-job `credits_used`, sidebar lifetime estimates.
- **Skeletons** — Scrape/Search/Browser all use Skeleton during load (keeping these).

### What's missing / weak
1. **Map / Crawl / Extract / Parse PDF** — all stubbed to `ComingSoon`. Need real implementations.
2. **No AI assistant** — no chat widget, no LLM tool-calling, no "ask Lovable AI to scrape X for me" flow.
3. **Scrape UI is functional but flat** — checkbox grid, no presets, no recent-URL chips, no live job preview, no header gradient like Home.
4. **No streaming response styling** — user wants the Lovable-style shimmer (left→right shiny gradient) on AI text while it streams.
5. **No global command palette / quick action bar.**
6. **Browser** results panel is dense; AI commands (e.g. "go to amazon and find X") not yet wired.
7. **No keyboard shortcuts**, no toasts on copy beyond default, no empty-state polish on Jobs.
8. **No retries, no concurrency** on scrape; long URLs not truncated nicely.

### Performance
- Scrape p50 3–5s, Search 2s/10 results, Browser launch 4–8s. Acceptable.
- Edge functions are stateless `fetch` proxies, no caching layer.

---

## Plan — what we'll build now

### 1. Scraper UI redesign (`src/pages/Scrape.tsx`)
Keep skeleton loader. Upgrade visuals + add power features:
- New hero header with `bg-gradient-hero` + animated `Globe` icon, matching Home.
- URL input gets: paste-detect, recent-URLs chip row (localStorage), "Clear" button.
- Format picker → tile grid with icons + cost badges per tile (live total updates).
- Add **preset buttons**: "LLM-ready (md+summary)", "SEO audit (links+meta+screenshot)", "Archive (raw+md+png)".
- Advanced panel expanded: `waitFor` (ms), `mobile` toggle, `includeTags`/`excludeTags` chips, `actions` (click/wait/scroll) mini-builder reusing Browser action types.
- Results view: sticky tab bar, markdown/HTML side-by-side toggle, "Open in Browser session" button.
- Subtle `animate-fade-in` + `hover-scale` utilities (add to `tailwind.config.ts`).

### 2. AI Assistant with shimmer streaming
- Add `supabase/functions/ai-assistant/index.ts` using **Lovable AI Gateway** (`google/gemini-3-flash-preview`) via Vercel AI SDK with tool-calling.
  - Tools: `scrape_url`, `search_web`, `launch_browser` — each invokes existing edge fns server-side and returns compact JSON.
  - `streamText` → `toUIMessageStreamResponse`.
- New floating **Assistant widget** (`src/components/AssistantDock.tsx`) available on every page (bottom-right), and full-page route `/assistant`:
  - ChatGPT-style: input bar, message list, tool-call cards (collapsible JSON), markdown render.
  - **Shimmer streaming**: assistant tokens render with a CSS mask gradient that sweeps left→right while `status === 'streaming'`. Once finished, settles into normal text. Implement with `@keyframes shimmer-sweep` + `background-clip: text` on a gradient (foreground → primary-glow → foreground), `animation: shimmer-sweep 2s linear infinite`. Stop animation on stream end.
  - Premium "faded shiny" look: card with subtle inner gradient border + backdrop-blur.
- Add `useChat` from `@ai-sdk/react`, `DefaultChatTransport` pointing to `/functions/v1/ai-assistant`.
- Persist conversation in `chat_messages` table (RLS scoped to user, threads by `conversation_id`).

### 3. Fill missing endpoints (real, not stubs)
- **Map** (`/map` + `firecrawl-map` edge fn) — POST `/v2/map`, render URL list with search filter, CSV/JSON export.
- **Crawl** (`/crawl` + `firecrawl-crawl`) — POST `/v2/crawl`, poll job status, depth/include/exclude controls, live progress bar.
- **Extract** (`/extract` + `firecrawl-extract`) — schema builder UI (field name + type), POST `/v2/extract`, render structured table.
- **Parse PDF** (`/parse` + `firecrawl-parse`) — file upload → temporary storage → scrape with `parsePDF: true`.

### 4. Polish layer
- Add `animate-fade-in`, `animate-shimmer-sweep`, `hover-scale`, `.story-link` to tailwind config + index.css.
- Command palette (`cmdk`): ⌘K opens global actions ("Scrape URL…", "Search…", "Open Assistant").
- Replace `ComingSoon` references in `App.tsx` and sidebar `ready` flags as endpoints ship.

### 5. Database
New migration:
- `chat_conversations(id, user_id, title, created_at)` RLS by user_id.
- `chat_messages(id, conversation_id, role, parts jsonb, created_at)` RLS via conversation ownership.
- `crawl_jobs(id, user_id, firecrawl_job_id, status, progress, ...)` for async crawl polling.

### 6. Secrets
- `LOVABLE_API_KEY` — auto-provisioned on first AI Gateway call (no user action needed).
- `FIRECRAWL_API_KEY` — already set.

---

## Order of execution (so each step is testable)

1. **Scraper UI redesign** + tailwind animation utilities (skeleton kept).
2. **Migration** for chat tables.
3. **`ai-assistant` edge function** with Lovable AI + tool-calling (scrape/search tools first).
4. **AssistantDock** floating widget with **shimmer streaming text** + full `/assistant` page.
5. **Map** endpoint (smallest of the missing four) — function + page.
6. **Crawl** with async polling.
7. **Extract** + schema builder.
8. **Parse PDF** with file upload.
9. Command palette + final polish, postmortem doc refresh.

---

## Technical notes

- Shimmer CSS lives in `index.css`:
  ```
  @keyframes shimmer-sweep {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .text-shimmer {
    background-image: linear-gradient(90deg,
      hsl(var(--foreground)) 0%,
      hsl(var(--primary-glow)) 50%,
      hsl(var(--foreground)) 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: shimmer-sweep 2.4s linear infinite;
  }
  ```
  Apply class only while message is streaming; remove on finish.
- AI Assistant uses Vercel AI SDK with `@ai-sdk/openai-compatible` against `https://ai.gateway.lovable.dev/v1`, header `Lovable-API-Key`. Tools defined with `tool({inputSchema, execute})`, `stopWhen: stepCountIs(50)`.
- Each tool's `execute` re-uses the existing `firecrawl-*` functions via direct `fetch` to Firecrawl (server-side, with the same `FIRECRAWL_API_KEY`) so we don't double-hop.
- Skeletons preserved everywhere; no removal.

Ready to implement on approval.
