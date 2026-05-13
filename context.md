# Project Context — Firecrawl Native Platform (Source of Truth)

> Revisit this file whenever context drifts. These are **non-negotiable**.

## Mission
Build a **native, beautiful, pro-grade UI** on top of the Firecrawl API that is dramatically better than Firecrawl's own dashboard. Firecrawl's UI is built for developers/AI agents and is confusing. Ours is built for **humans who want pro results without reading docs** — but still exposes **every** Firecrawl endpoint and feature.

## Non-negotiables
1. **Quality over speed.** Never degrade UI/UX quality to ship faster.
2. **All Firecrawl endpoints are first-class.** Each endpoint gets its own dedicated section/flow:
   - Scrape (single URL, all formats: markdown, html, rawHtml, links, screenshot, branding, json, summary)
   - Search (web search w/ optional scrape of results)
   - Map (fast URL discovery)
   - Crawl (recursive, async, with status polling)
   - Extract (LLM-powered structured data, schema or prompt)
   - PDF / Document parsing
   - Browser / Desktop session (interactive browser view)
   - Any new endpoint Firecrawl ships → add a section.
3. **Every endpoint ships with a tuned "system instruction" / preset** that produces measurably better results than firecrawl.dev's defaults. User can **view** and **hide** the system instruction.
4. **Minimalist hero search bar** as primary entry, with **attachment-style options** (link, file, goal selector: scrape / extract / search / crawl / map / parse).
5. **Loading = skeleton views + smooth animations.** No spinners on a blank page.
6. **Results live in a "Job" section.** Every run is a job. Properly formatted, copyable, downloadable.
7. **Downloads:** every job exposes all available artifacts as separate download buttons — Markdown (.md), JSON, HTML, raw HTML, screenshot (.png), CSV (when tabular), Schema (.json), plus copy-to-clipboard for text.
8. **Beginner-friendly, pro-capable.** Defaults are smart; advanced panel reveals every Firecrawl param.
9. **Design:** inspired by Firecrawl's brand (fire/orange) but cleaner, more Linear/Vercel-like polish. Dark-first. Semantic tokens only — no ad-hoc colors.
10. **Backend:** Lovable Cloud + Firecrawl connector. API key NEVER touches the browser. All Firecrawl calls go through edge functions.

## Credits & Cost Transparency (must surface in UI)
- User has **83,000 Firecrawl credits** + Hobby plan.
- Show estimated credit cost **before** running a job and **actual** cost after.
- Rough Firecrawl credit costs (display in UI, keep updated against docs):
  - Scrape: 1 credit / page (markdown/html). +1 if `screenshot`. +5 if `json`/`extract` (LLM).
  - Map: 1 credit / call (up to 5000 URLs).
  - Search: 1 credit / result returned. +scrape cost if scrapeOptions used.
  - Crawl: 1 credit / page crawled (× format multipliers).
  - Browser session: time-based — ~1 credit / minute of active session (verify against docs; warn user before long sessions).
- "How long will 83k credits last?" widget on dashboard:
  - ~83,000 simple scrapes, OR
  - ~16,600 LLM-extract scrapes, OR
  - ~1,380 hours of browser session (~57 days continuous), OR
  - mixed estimator.

## Two Deliverables
1. **Web app** (this repo) — the platform.
2. **Chrome Extension** (MV3) — packaged ZIP downloadable from the web app. Lets the user trigger scrape/extract on the current tab via the same backend. Files: `manifest.json`, `popup.html`, `popup.js`, `background.js`, icon. Built later, after web MVP is solid.

## UX Pillars
- Hero search bar (goal selector + URL/query input + attachments).
- Sidebar nav: Dashboard, Scrape, Extract, Search, Map, Crawl, Parse (PDF), Browser, Jobs, Settings.
- Each endpoint page: input form (simple by default) → "Advanced" collapsible → "System instruction" toggle (view/hide/edit) → Run button with credit estimate → skeleton loader → Job result panel.
- Jobs page: history of every run, filter by type, re-run, download artifacts.

## Tech
- React + Vite + Tailwind + shadcn (heavily themed).
- Lovable Cloud (Supabase) for auth, job history, artifact storage.
- Firecrawl connector (gateway) — never expose key client-side.
- Edge functions: one per endpoint family (`fc-scrape`, `fc-search`, `fc-map`, `fc-crawl`, `fc-extract`, `fc-parse`, `fc-browser`).

## Definition of Done (MVP v1)
- Landing/dashboard with hero search bar + credit widget.
- Scrape page fully working end-to-end via Firecrawl connector.
- Job result with skeleton loader, formatted output, all download buttons.
- Sidebar shell + placeholder pages for the other endpoints (clearly marked "coming next").
- Dark theme, Firecrawl-inspired but original.

_This file is the contract. If a change conflicts with it, update this file first._
---

## Firecrawl as Orchestrated Substrate (added 2026-05-13)

Raw Firecrawl endpoints, called directly with default settings, produce noisy and generic results — markdown bloated with nav, weak summaries, untargeted search results. Firecrawl is a great primitive but a poor product on its own.

This platform's core thesis: **Firecrawl is the substrate, our agent is the product.** Every endpoint is wrapped by:
1. **Tuned system instructions** per endpoint (Scrape preset for LLM-readiness, Search preset for SERP precision, etc.).
2. **An AI orchestrator** (`ai-assistant` edge function, Gemini 3 Flash) that chains tools — `search_web` → `scrape_url` → summarize — instead of one-shot calls.
3. **Snapshots** — the highest-level abstraction. A Snapshot is a named, repeatable agent recipe (Medium pull, Reddit sweep, Leads finder) with fixed params, a step graph, and packaged deliverables (MD/CSV/JSON/screenshots/PDF).

When users want results, they reach for a Snapshot. When they want exploration, they chat the Assistant. When they want low-level control, they use the dedicated endpoint pages. All three layers route through the same hardened edge functions.
