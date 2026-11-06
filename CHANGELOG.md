# Changelog

All notable changes to My-Starred-Repos.

## [v0.4] — 2026-11-05 — Truth pass, hardening, and calmer UI

The previous entries described things the repo did not actually do. This release makes the claims match the code.

### Fixed
- **Corrupt `localStorage` no longer blanks the page.** Pins and view mode are read through guarded helpers, so a malformed value falls back to defaults instead of throwing before the first render.
- **Cache-busting defeated the CDN.** `app.js` appended `?t=<timestamp>` to every `repos_output.json` fetch, which turned the `s-maxage=3600` rule into a cache miss and shipped ~950 KB per view. The fetch is now plain, and asset versions are derived from file hashes (`style.css?v=60e98401`) instead of hand-edited constants that drifted.
- **Wrong identity URLs** on the baked page: portfolio is `akashpriyadarshi.is-a.dev` (the old Vercel URL 308-redirects) and LinkedIn is `linkedin.com/in/akashpriyadarshii`.
- **False claims removed**: "auto-updated weekly via GitHub Actions" (there is no workflow and no cron), TF-IDF/cosine scoring (the matcher is weighted keyword overlap), fuzzy search (it is substring matching), "MCP compatibility" (there is no MCP server, only an HTTP endpoint), `changefreq=weekly` in the sitemap, and "auto-updated daily" in the manifest.
- **Snapshot age is visible** in the header instead of a pulsing "live" dot.
- **`repo.language` is escaped** in both card and row templates.
- Search debounce is cancelled when the field is cleared, so a stale timer cannot re-filter.
- Dead code removed: `count_label()`, unused `categories` parameter of `render_sitemap`, the visitor counter and its countapi dependency, the unused Instrument Serif font and `--font-accent` token.

### Redesigned
- **One idea carries the page.** The library is drawn as a ledger: a single stacked bar of all repos split by category, server-rendered into `index.html`, clickable as the filter, with the 714-repo AI share stated once in the intro line. It replaces the vanity metric cards, the header follower/repo counts, the equal-weight category pills, the topic cloud and the top-10 list.
- **Direction `data-terminal`**: near-black warm ground, amber used only as a 1px line or a selection mark, tabular numerals, 56px table rows, no glass, no bloom, no grain, no hover glow, no emoji, no sub-11px text.
- **One view.** The grid/compact toggle and the broken compact-row layout are gone; compact is the page.
- **Type**: Public Sans + JetBrains Mono (down from three faces, Instrument Serif dropped), 12.5–20px, sentence-case labels instead of tracked 10px caps.
- The FAQ moved behind `<details>`; the matcher keeps its drawer and no longer inherits a filter after closing.

### Changed
- **`/api/search`** honours the documented contract: `GET`/`HEAD` only (`405` otherwise, with `Allow`), absent or empty filters mean "no filter", unknown `category`/`sort` return `400` with the allowed values, `limit` clamps to 1–100, `offset`/`next_offset` paginate, and the response carries `generated_at`, `data_age_seconds`, `schema_version`, `sync_mode`. The JSON snapshot is parsed once per warm instance instead of per request, and errors no longer echo server paths.
- **`fetch_stars.py`** does a full sync by default and takes `--incremental` as an opt-in. The dataset gained `schema_version`, `sync_mode`, `requests_used`, and per-repo `synced_at`; the derived per-repo `rank` field is gone. Incremental runs keep old records untouched, including their `synced_at`, so stale metadata stays visible.
- **`build_site.py`** gained `--check` (exit 1 when committed output drifts from the generator), bakes the real metric numbers into the shell, and stops emitting the per-category `llms-*.txt` files (11 files, and the loop never deleted orphans). `llms.txt` and `llms-full.txt` now open with a dataset metadata block.
- **Design**: removed the ambient bloom field, grain overlay, animated scrollbar pulse, pulsing sync dot, card edge-glow stripe, staggered card entrance, shimmer skeleton, and the five frosted `backdrop-filter` layers. Compact list is now the default view. Muted text was lifted from `oklch(58%)` to `oklch(68%)` for contrast on the `oklch(13%)` paper.

### Added
- `tests/test_contract.py` — checks the dataset shape, category validity, and that generated files match `build_site.py`.
- `tests/test_api_search.mjs` — exercises the search handler with stub requests: 405, empty filters, alias resolution, bad sort, pagination.

---

## [v0.3] — 2026-08-30 — Bloom Warm-Amber Aura Redesign (reverted in v0.4)

Full frontend skin overhaul to a premium atmospheric "Bloom" register (Hallmark Hyperlane theme), replacing the dev-tool terminal look.

### 🎨 Design
- **Warm amber "aura" theme**: OKLCH token system throughout — warm charcoal paper (no violet/cyan), single warm-amber accent, amber + coral bloom pair.
- **Ambient atmospheric backdrop**: two drifting radial `.bloom` gradients (GPU-safe transform, `blur`) + SVG film-grain overlay, injected by `build_site.py`.
- **Typography**: swapped Geist/Geist Mono for Inter Tight (weighty-sans display), Inter (body), JetBrains Mono (data/labels) + Instrument Serif accent. Giant display scale (`clamp(2.75rem, 8vw, 7.5rem)`), `theme-color` `#16100b`.
- **shadcn-grade polish**: refined focus rings / `:focus-within` search glow, amber-tinted layered shadows, atmospheric pulsing scrollbar, segmented view toggle, pill chips.
- **Motion**: ease-out-expo choreography, staggered card fade-in, GPU-composited `scaleY` edge-glow reveal (no layout thrash), tactile `:active` press, `prefers-reduced-motion` support.

### 🔧 Build
- `build_site.py`: Inject ambient aura divs, Bloom font link, updated theme-color, CSS cache-buster `?v=5 → ?v=8`.
- `style.css`: full rewrite (~900 lines), class names preserved — no JS changes required.

---

## [v0.2] — 2026-08-28 — Dual-Audience Platform (Humans & AI Agents) (per-category llms files and weekly cron removed in v0.4)

Major update turning My-Starred-Repos into a dual-purpose platform for developer discovery and machine-readable AI agent context.

### 👤 For Humans
- **Compact list view toggle**: Grid view vs dense single-line table mode toggle, persisted in `localStorage`.
- **Bookmarks & Pinned tab**: Save repos with one click; dedicated "📌 Pinned (N)" tab in category navigation.
- **One-click `git clone` copy**: Copy button on every card/row copies `git clone <url>.git` directly with toast feedback.
- **Archive status pill**: Repos marked archived on GitHub display a red archived pill.

### 🤖 For AI Agents & Vibe Coders
- **Vibe Coder Project Matcher**: Built-in client-side relevance scoring tool. Paste project ideas, READMEs, or stack descriptions to calculate cosine & term-overlap matches across 960+ repos with match percentage scores.
- **REST Search API (`/api/search`)**: Vercel serverless function endpoint with CORS support, filtering by query, category, language, and limit for external agents/MCP servers.
- **Per-category `llms-*.txt` endpoints**: Generated dedicated text files for every category (`llms-ai-agents.txt`, `llms-dev-tools.txt`, `llms-mobile.txt`, `llms-llm-rag.txt`, `llms-web-automation.txt`, etc.).
- **Enhanced `llms.txt`**: Added category index manifest and search topic taxonomy.

### ⚙️ Automation & Pipeline
- **Weekly sync schedule**: Updated GitHub Actions cron from daily to weekly (`0 0 * * 0`) on Sundays at 00:00 UTC, with `workflow_dispatch` enabled for manual sync runs between 1–7 days.
- **`fetch_stars.py`**: Added `pushed_at` and `archived` fields to output dataset.
- **`build_site.py`**: Generates all per-category llms files and dynamic sitemap entries.
- **`vercel.json`**: Added CORS and caching headers for `/api/*` and all `/llms*.txt` endpoints.

---

## [v0.1] — 2026-08-28 — Initial Public Version

Initial public release with search, categorization, and SEO/GEO optimization.

### Added
- **SEO & GEO overhaul**: `<meta name="keywords">`, Schema.org `keywords` array, topic badge cloud (10 search clusters)
- **FAQ section**: Pre-rendered HTML citation-ready for Google AI Overviews and Perplexity
- **`llms.txt` / `llms-full.txt`**: Topic taxonomy block for AI search engine indexing
- **Chunked progressive rendering**: `app.js` (`BATCH_SIZE=60`, `IntersectionObserver`) for INP and DOM performance
- **Dynamic `sitemap.xml`**: Generated by `build_site.py` with daily `<lastmod>`
- **Asset caching**: Long-lived caching in `vercel.json`

### Fixed
- `clean_summary()` sentence splitter abbreviations fix
- Taxonomy keyword word-boundary matching
- JSON-LD `itemListElement` serialization fix

---

## [2026-08-06] — SEO rebuild + taxonomy fix

### Fixed
- Taxonomy bug: word-boundary matching for short keywords. AI & Agents 500 → 465
- JSON-LD `itemListElement` double-encoding bug

### Added
- `build_site.py` — generates `index.html`, `llms.txt`, `llms-full.txt`
- `generate_assets.py` — brand icons, favicon, og-image, manifest
- `vercel.json` — caching rules

---

## [2026-07-31] — Fix stale site + cleanup

**Shipped**: `6374b6a`

### Fixed
- Stale live site redeployed (658 repos → 781 repos)
- README broken link `/dashboard/` → `/`
- Dead code in `app.js`
- Security: `repo.url` escaped in card hrefs
- Git identity corrected: `272530059+AkashPriyadarshii@users.noreply.github.com`

---

## [2026-07-11] — Site redesign

Rebuilt as static SPA: vanilla HTML/CSS/JS, `app.js` renders `repos_output.json`, category tabs, language filter, sort, search, dark theme. Removed old `admin/`, `api/`, `dashboard/` structure.

## [2026-06-17 → 2026-07-11] — Daily sync commits

`[auto] Sync starred repos` — daily cron updates `repos_output.json` (GH Action).

## [2026-06-20 and earlier] — Original site

Legacy `My-Starred-Repos` site (Vercel/Supabase, auto-sync via `fetch_stars.py` + `keep_alive.py`).
