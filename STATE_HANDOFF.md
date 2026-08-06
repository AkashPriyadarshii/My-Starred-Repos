# State Handoff

> Last updated: 2026-08-06 (India time)

## Current state (working)

- **Site live**: `https://my-starred-repos.vercel.app` — 800 starred repos, data generated 2026-08-06
- **Repo**: `AkashPriyadarshii/My-Starred-Repos`, branch `main` (clean, pushed)
- **Deploy**: pushing to `main` triggers the Vercel deploy (git-connected — do NOT use `vercel --prod`)
- **Data pipeline**: GH Action `sync-stars.yml` runs `fetch_stars.py` + `build_site.py` daily (cron `0 0 * * *`), commits fresh `repos_output.json` + generated `index.html`/`llms.txt`/`llms-full.txt` when changed

## 2026-08-06 — SEO rebuild + taxonomy fix (shipped in this commit)

### Taxonomy fix (root cause)
`fetch_stars.py` matched keywords as bare substrings — `"ai"` matched "gmail", "main", "container", "perform", etc., dumping ~120 repos into **AI & Agents**. Fix: word-boundary matching (`\b…\b`) for short keywords (len < 4); longer keywords keep substring matching so compounds ("ioredis"→redis) still work. **AI & Agents 500 → 465**, Databases restored (was polluted by `'orm'` matching "perform"/"framework").

### What was added
| Piece | File |
|-------|------|
| Site builder (bakes SEO-critical content + JSON-LD + llms.txt) | `build_site.py` |
| LLM-facing text files | `llms.txt`, `llms-full.txt` |
| Brand asset generator (icons/favicon/og-image/manifest) | `generate_assets.py` |
| Generated assets (re-run only on brand change) | `icons/*`, `favicon.ico`, `manifest.webmanifest` |
| CI runs build + commits site | `.github/workflows/sync-stars.yml` |
| Long-lived static-asset caching | `vercel.json` |

### Also fixed
- **JSON-LD bug**: `about.itemListElement` was double-encoded (serialized to a string) → schema-invalid. Now a real array of 20 `SoftwareSourceCode` items.
- `dateModified` in JSON-LD now derived from `repos_output.json`'s `generated_at` (no more manual edit on deploy).

## Identity / signing (resolved 2026-07-31, unchanged)

- Git config: `user.name=Akash Priyadarshi`, `user.email=272530059+AkashPriyadarshii@users.noreply.github.com`
- Signing OFF — HTTPS via gh credential manager
- `user.name` is one `i` short of handle `AkashPriyadarshii`; matches profile display name — leave

## Environment notes

- Windows 11, git via HTTPS (no SSH key on this laptop)
- Vercel CLI installed but unused for deploy (push deploys)
- gh CLI authed as `AkashPriyadarshii`
- Python: `fetch_stars.py` runs clean locally with `GITHUB_TOKEN` (gh auth token works); `build_site.py` needs no env; `generate_assets.py` needs PIL

## Local uncommitted / ignored

- `.gitignore` modified (adds `.vercel`, `*-audit/`) — committed
- `my-starred-repos.vercel.app-audit/` — local SEO audit output, git-ignored
- `.omc/` — local tooling junk, never commit
