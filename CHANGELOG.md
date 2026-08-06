# Changelog

All notable changes to My-Starred-Repos. Auto-generated daily sync commits are summarized; only meaningful changes are itemized.

## [2026-08-06] — SEO rebuild + taxonomy fix

### Fixed
- **Taxonomy bug**: `fetch_stars.py` matched keywords as bare substrings — `"ai"` matched "gmail", "main", "container", "perform", etc., dumping ~120 repos into **AI & Agents**. Word-boundary matching for short keywords (len < 4) fixes it; longer keywords keep substring matching so compounds still work. AI & Agents 500 → 465.
- **JSON-LD `about` bug**: `itemListElement` was serialized to a string (double-encoded) → schema invalid. Now a real array of 20 items.

### Added
- **`build_site.py`** — generates `index.html` from data: accurate title/count, real `dateModified` from `generated_at`, ItemList JSON-LD, cache-busted assets, baked crawlable content section (non-JS crawlers + AI answer engines get real content)
- **`llms.txt`** + **`llms-full.txt`** — for LLM/answer-engine consumption
- **`generate_assets.py`** — real brand icons (`icons/icon-192.png`, `icon-512.png`), `favicon.ico` (multi-size), 1200×630 `og-image.png`, `manifest.webmanifest`. Matches `style.css` design tokens (bg `#09090b`, accent `#34d399`)

### Infrastructure
- **`sync-stars.yml`**: runs `build_site.py` after fetch; commits `index.html` + `llms.txt` + `llms-full.txt` alongside data
- **`vercel.json`**: long-lived `immutable` cache for `/icons/*`, 1-day cache for `llms.txt`/`llms-full.txt`, short cache for `manifest.webmanifest`

---

## [2026-07-31] — Fix stale site + cleanup

**Shipped**: `6374b6a`

### Fixed
- **Stale live site**: Vercel was serving a July 11 snapshot (658 repos). Redeployed current files (781 repos) via `vercel --prod`. Site now shows fresh data.
- **README broken link**: `/dashboard/` (404) → `/` (root)
- **Dead code**: `changelogRes`/`Promise.allSettled` → plain fetch in `app.js`
- **Security hardening**: `repo.url` now escaped in card `href`s (defense-in-depth)
- **Removed dead `onclick=stopPropagation`** from card link
- **Removed `console.log`** perf line + unused `t0` var
- **`fetch_stars.py`**: empty `GITHUB_USERNAME` guard (was: empty string → 404 on `users/` endpoint)
- **Stale JSON-LD `dateModified`** refreshed (2026-07-11 → 2026-07-31)

### Added
- `CLAUDE.md` — project doc: data pipeline, conventions, verify steps

### Infrastructure
- Git identity corrected: `user.email` → `272530059+AkashPriyadarshii@users.noreply.github.com` (was a different user's noreply — one `i` short — which triggered GitHub vigilant mode)
- SSH key + commit signing removed (key was minted under the wrong identity); signing now off, git uses HTTPS

### Known
- Vercel project still NOT git-connected — push doesn't auto-deploy. Manual `vercel --prod` required until connected in dashboard.

---

## [2026-07-11] — Site redesign (from git history)

Rebuilt as static SPA: vanilla HTML/CSS/JS, `app.js` renders `repos_output.json`, category tabs, language filter, sort, search, dark theme. Removed old `admin/`, `api/`, `dashboard/` structure, `keep_alive.py`, Supabase integration.

## [2026-06-17 → 2026-07-11] — Daily sync commits

`[auto] Sync starred repos` — daily cron updates `repos_output.json` (GH Action). No code changes.

## [2026-06-20 and earlier] — Original site

Legacy `My-Starred-Repos` site (Vercel/Supabase, auto-sync via `fetch_stars.py` + `keep_alive.py`).
