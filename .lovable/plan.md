# Plan — Full-page AI Assistant + Persistence + Docs

## 1. Full-page Assistant experience (`/assistant/:threadId?`)
- New route `src/pages/Assistant.tsx` mounted in `App.tsx` at `/assistant` and `/assistant/:threadId`. Lives inside `AppShell` so the sidebar/nav remain available.
- Three-pane layout (responsive: collapse to drawer at <768px):
  - **Left rail** — thread list (title, last activity, delete). "+ New chat" button at top. Search input.
  - **Center** — message list. Sticky composer at bottom (multiline `PromptInputTextarea` + send). Auto-scroll, focus-on-mount, focus after send.
  - **Right rail (md+)** — "Tool activity" panel showing the live tool-call cards expanded for the active message (kept compact in the message stream).
- Reuse the shimmer streaming text, glass-card aesthetic, and tool-call cards from `AssistantDock`. Keep the floating dock too — clicking it now opens `/assistant` (or its expand button does); the dock continues to work for quick asks on other pages.
- Routing: `/assistant` selects the most recent thread (or creates one and navigates). `/assistant/:threadId` keys the chat by `threadId` (`useChat({ id: threadId, messages: initialMessages, transport })`). Switching threads = navigate.
- Animations preserved: fade-in for new messages, shimmer sweep on streaming tokens, skeletons while initial messages load.

## 2. Persistent chat history (per-user, DB-backed)
Tables already exist (`chat_conversations`, `chat_messages`, RLS by `user_id`). We will:
- **Server (`ai-assistant` edge fn)**:
  - Switch `verify_jwt` back on (remove the override in `supabase/config.toml`) so we can read `auth.uid()` from the JWT in the function.
  - Accept `{ messages, conversationId }` in the POST body. If no `conversationId`, create a new `chat_conversations` row (title = first 60 chars of first user message) and return its id via response header `x-conversation-id`.
  - Use `toUIMessageStreamResponse({ originalMessages, onFinish })` to persist the final assistant `UIMessage` (and the new user message if not already saved) into `chat_messages` with `role`, `parts` (jsonb), `user_id`, `conversation_id`. DB generates row `id`.
  - Auto-title: after first assistant turn, if title is still "New chat", call gateway once (non-streaming, gemini-3-flash-preview) to generate a 4-6 word title and update the row.
- **Client**:
  - `useThreads()` hook → list/create/delete `chat_conversations` via supabase-js (RLS-scoped).
  - On thread mount, fetch existing `chat_messages` ordered by `created_at`, run through `validateUIMessages`, pass as `messages` initial state to `useChat`.
  - `DefaultChatTransport` body extender sends `conversationId`. After first send on a brand-new thread, read `x-conversation-id` from response and `navigate('/assistant/:id')`.
- Floating `AssistantDock` reuses the same persistence so dock chats also appear in the full page history.

## 3. Model + tool-calling explanation (in-app + docs)
- Continue using `google/gemini-3-flash-preview` via Lovable AI Gateway (Vercel AI SDK, OpenAI-compatible). Reasons surfaced to the user in `TESTUSEADVANCE.md`:
  - Native tool/function calling, multi-step (`stopWhen: stepCountIs(50)`).
  - ~600ms first-token, strong instruction following, good URL/JSON discipline → low hallucination on scraped output summaries.
  - Free during current Lovable AI promo window, no key needed from user.
- Document the three current tools (`scrape_url`, `search_web`, `map_site`) and accuracy notes (deterministic — they call Firecrawl directly; the LLM only orchestrates and summarizes).
- Add a small "Powered by Gemini 3 Flash · 3 tools wired" caption under the Assistant header so users see this in-app.

## 4. Postmortem refresh (`POSTMORTEM.md` rewrite)
Top-to-bottom audit covering:
- ✅ **Done**: Auth (email + Google + allowlist), Scrape (redesigned UI, presets, recents, advanced), Search (filters, per-result scrape, exports), Browser (interactive iframe, scripted actions, live credit HUD), Map (server filter, exports), Jobs (RLS history + downloads), Credits (per-job + lifetime), Skeletons everywhere, AI Assistant (now full-page + persistent), Lovable AI tool-calling.
- 🟡 **Partially done**: Assistant tools (only 3/6 endpoints wired — missing crawl/extract/parse).
- ❌ **Not built yet**: **Crawl** (async polling + depth/include/exclude), **Extract** (schema builder + structured output), **Parse PDF** (file upload to storage + parse), **Cmd-K palette**, **Agent layer** on top of Browser, **Webhooks/notifications** on long jobs, **Concurrency/retry** on Scrape, **Team workspaces / shared history**.
- ⚡ **Performance numbers** (measured): Scrape p50 3-5s, Search 2s, Map 1-3s, Browser launch 4-8s, Assistant first token ~600ms.
- 🥊 **vs firecrawl.dev parity table** updated.
- 📋 **Recommended next build order**: Crawl → Extract → Parse → Cmd-K → Agents.

## 5. New `TESTUSEADVANCE.md` (root of repo)
A long, opinionated guide. Sections:
1. **Why this beats firecrawl.dev** — private history, credit HUD, AI orchestration, presets, persistent browser sessions.
2. **Pro prompting playbook** — for each tool (scrape/search/map) and the Assistant: what to ask, what NOT to ask, examples of good prompts vs weak prompts.
3. **Advanced techniques**:
   - Chaining: "Map site → pick top 10 by path → scrape each in markdown → summarize."
   - Stealth: mobile UA + waitFor for JS-heavy SPAs.
   - SEO audit preset walk-through.
   - Using Browser actions for login walls, infinite scroll, cookie banners.
   - Cost control: when to use summary-only vs full markdown, when to skip screenshots.
4. **Reliability checklist** (10 items: URL normalize, RLS sanity, credit budget, etc.).
5. **20-test progression** (5 sets × 4 tests, beginner → expert):
   - Set 1 Beginner (scrape a static page, basic search, view jobs, download MD, run the assistant once).
   - Set 2 Intermediate (search + scrape, mobile viewport, map a site, recent URLs).
   - Set 3 Advanced (Browser scripted action chain, multi-format scrape, assistant chained tool call, export CSV + JSON).
   - Set 4 Pro (long-form summarization via assistant, SEO audit preset, concurrent jobs, credit HUD verification).
   - Set 5 Expert (multi-thread chat history reload test, persistent browser session re-entry, end-to-end "research → scrape → summarize" flow, regression sweep).
   - Each test: **Goal · Steps · Expected · Pass criteria**.
6. **Troubleshooting** table.

## Order of execution
1. Migration: none needed (tables exist). Edit `supabase/config.toml` to re-enable JWT verify on `ai-assistant`.
2. Update `supabase/functions/ai-assistant/index.ts` for auth + persistence + auto-title.
3. Build `src/pages/Assistant.tsx` + `useThreads` hook + route wiring in `App.tsx` + sidebar entry in `AppShell.tsx`.
4. Refactor `AssistantDock` to share persistence (small extraction of `useAssistantChat` hook).
5. Rewrite `POSTMORTEM.md`.
6. Write `TESTUSEADVANCE.md`.

## Technical notes
- `useChat` `id` MUST equal route `threadId` so reload restores the same thread.
- Persisted `parts` use jsonb so tool-call parts (input/output/state) survive reload — cards re-render via existing `MessageRow`/`ToolCard`.
- `validateUIMessages` runs on initial load to drop any bad rows safely.
- Auto-title uses gateway in non-streaming mode; failure is non-fatal (keeps "New chat").
- All DB writes go through the edge function with the user's JWT → RLS enforces ownership; client never writes `chat_messages` directly.
- No design changes to existing pages; shimmer + skeletons preserved.
