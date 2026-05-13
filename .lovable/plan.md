# Plan — Chat fix + Snapshots system + Docs

## 1. Fix: AI Assistant goes blank after clicking a preset

### Root cause analysis
Flow when clicking a preset on `/assistant`:
1. `startNewChat` creates a `chat_conversations` row, then navigates to `/assistant/{id}?prefill=...`.
2. `ChatWindow` mounts with empty `initialMessages` and runs the prefill effect → `sendMessage({ text: prefill })`.
3. The edge function receives `conversationId` (already exists), tries to insert the user message, then streams.

Likely failure points (all silent in current code):
- The `prefill` effect runs on mount with `[]` deps and may fire before `useChat` is fully wired in some renders → the message is dropped without UI feedback.
- If `streamText` / gateway returns a non-stream error (e.g. 402, 429, malformed tool call), the UI shows nothing because `error` rendering only fires when `useChat` receives a parsed error event. A Response with `status: 500` JSON body bypasses the stream parser and leaves the chat blank.
- The edge function's `onFinish` persists the assistant message but throws if `parts` shape isn't valid jsonb — currently swallowed in a try/catch but the response can already be closed by then.

### Fix
**Edge function (`supabase/functions/ai-assistant/index.ts`)**
- Wrap firecrawl tool errors so they return as tool `output` instead of throwing — never let a tool exception kill the stream.
- Add structured console logging at each step (auth ok, conv id, tool start/end, finish) so we can see what's happening in edge logs.
- Ensure error responses always include `corsHeaders` and `x-conversation-id` (already partial).
- Validate `messages` is a non-empty array before calling the gateway; return a clear 400 otherwise.

**Frontend (`src/pages/Assistant.tsx`)**
- Replace the "fire-and-forget" prefill `useEffect` with a guarded version that:
  - Waits until `useChat` reports `status === "ready"` (or first render after mount completes).
  - Catches `sendMessage` rejections and surfaces a toast.
- Always render a visible status row beneath messages (Thinking… / Streaming… / Error / Idle) so the screen never appears blank.
- If `messages.length === 0 && !isWorking && !prefillUsed`, show a small "Tap a suggestion to start" hint instead of empty whitespace.

## 2. New feature: **Snapshots** (presets / repeatable scrape workflows)

### Concept
A Snapshot is a reusable, named scraping workflow with:
- A target source category (Medium, Reddit, Leads, Custom).
- Fixed parameters (keywords, filters, formats).
- Output deliverables (MD, CSV, JSON, screenshots, PDF).
- An execution recipe — chain of Firecrawl + AI tool calls orchestrated by our agent (not raw Firecrawl).

This makes Firecrawl behave like an orchestrator backed by our prompts, not a raw API.

### Scope for this round (scaffold only — no full execution engine yet)
- New route `/snapshots` and sidebar entry "Snapshots" (with `Camera`/`Layers` icon).
- DB tables: `snapshots` (id, user_id, name, kind, params jsonb, recipe jsonb, deliverables text[], created_at) and `snapshot_runs` (id, snapshot_id, user_id, status, result jsonb, credits_used, created_at). RLS scoped to user.
- `src/pages/Snapshots.tsx`:
  - Grid of snapshot cards (name, kind badge, last run, "Run" + "Edit" buttons).
  - "Create snapshot" button → modal with form (name, kind selector, JSON params editor, deliverables checkboxes). Save inserts a row.
  - Three **starter (built-in) snapshots** seeded from code (not DB): Medium Blogs, Reddit Threads, Leads Finder. Shown above the user's own snapshots.
- Built-in snapshot definitions live in `src/lib/snapshots.ts` as typed objects:
  - `medium-blogs`: input `{ keyword, limit }`. Recipe: `search_web("site:medium.com {keyword}")` → for each result `scrape_url(url, formats:[markdown,summary])` → emit MD + CSV (title, url, author, summary).
  - `reddit-threads`: input `{ subreddit?, query, limit, timeframe }`. Recipe: `search_web("site:reddit.com {query} ...")` → scrape each thread → emit MD + JSON (title, url, OP body, top comments).
  - `leads-finder`: input `{ niche, region, intent }`. Recipe: parallel `search_web` over Reddit/X/Facebook/Yelp/Craigslist with intent keywords ("looking for", "need help with", "recommend a") → scrape promising results → AI-summarize each into a lead card (who, where, ask, contact hint, why-fit).
- "Run" only opens a stub dialog showing the recipe and an "Execution engine coming next" notice — wiring the runner is phase 2 (will use the existing `ai-assistant` agent + new tool `run_snapshot_step`).

### Why scaffold-first
You said you don't expect everything in one go. This locks in shape, DB, and UI; later turns build the executor + per-snapshot result viewers.

## 3. Docs updates

### `context.md`
Append a new section **"Firecrawl as Orchestrated Substrate"** stating: Raw Firecrawl endpoints produce noisy/generic results. Our platform wraps every endpoint with tuned system prompts + an AI orchestrator (Gemini 3 Flash) that chains tools, filters, summarizes, and packages outputs. Snapshots are the highest-level abstraction — repeatable agentic recipes.

### `TESTUSEADVANCE.md`
Add **Set 2 — Source-Specific Mastery (5 tests)**:
- 2.1 Reddit thread + top-comment extraction (single thread URL)
- 2.2 Reddit subreddit hot-topic sweep (search-then-scrape)
- 2.3 Medium blog discovery + content pull by keyword
- 2.4 Research paper extraction (arxiv/abstract + sections + references)
- 2.5 Multi-source comparison (same topic, Reddit vs Medium vs blog tone diff)
Each test: Goal / Steps (assistant prompts to paste) / Expected output / Pass criteria.

Also add **Set 6 — Snapshots (4 tests)**: run Medium snapshot, run Reddit snapshot, run Leads snapshot, create + run a custom snapshot.

## 4. Medium / Reddit / Leads — how it works (will be explained in chat reply, not just docs)

Short version delivered in the assistant text reply after plan approval:
- **Medium**: `search_web` with `site:medium.com {keyword}` (Firecrawl Search returns Google-quality SERP) → top N URLs → parallel `scrape_url` with `onlyMainContent:true, formats:[markdown,summary]` → assemble into a single MD bundle + CSV index.
- **Reddit**: same shape but `site:reddit.com/r/{sub}` and we keep comment markdown (Reddit's old.reddit pages render cleaner — snapshot will rewrite URLs to `old.reddit.com`).
- **Leads**: orchestrated multi-query search across Reddit/X/Facebook/Craigslist/Yelp using intent phrases. AI ranks each result by buying-intent score and outputs a lead card.

## Files to create/modify

**Create**
- `src/pages/Snapshots.tsx`
- `src/lib/snapshots.ts` (built-in snapshot definitions + types)
- `src/components/snapshots/SnapshotCard.tsx`
- `src/components/snapshots/CreateSnapshotDialog.tsx`
- New migration: `snapshots` + `snapshot_runs` tables with RLS

**Modify**
- `supabase/functions/ai-assistant/index.ts` (resilient tool errors + logging + 400 validation)
- `src/pages/Assistant.tsx` (guarded prefill, visible status row, error toast)
- `src/components/layout/AppShell.tsx` (sidebar entry)
- `src/App.tsx` (route)
- `context.md` (orchestrator philosophy)
- `TESTUSEADVANCE.md` (Set 2 + Set 6)

## Out of scope this round
- Actual snapshot execution engine (next round, after we validate UI shape).
- Real CSV/PDF export pipeline for snapshot results (next round).
- People-in-Need live data feed — only the snapshot definition + UI now.
