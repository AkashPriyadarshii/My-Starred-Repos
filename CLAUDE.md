# CLAUDE.md

## Project

GitHub-starred-repos dashboard, static SPA on Vercel. Repo = single source of truth. **No Vercel CLI deploys — pushing to `main` triggers the deploy.**

## Data pipeline

- `fetch_stars.py` — pulls all starred repos from GitHub API, categorizes by keyword, writes `repos_output.json`
- `.github/workflows/sync-stars.yml` — runs daily (cron `0 0 * * *`), commits fresh `repos_output.json` if changed. Uses ephemeral `secrets.GITHUB_TOKEN`
- Site renders `repos_output.json` — no backend, no DB

## Key files

| File | Role |
|------|------|
| `index.html` | Shell + SEO (OG/Twitter/JSON-LD). `dateModified` in JSON-LD is manual — update on deploy |
| `app.js` | SPA: fetch → profile → metrics → category tabs → lang filter → sort → card grid |
| `style.css` | Dark theme, CSS vars, Geist font |
| `vercel.json` | `cleanUrls`, security headers, `repos_output.json` cache `max-age=3600, stale-while-revalidate=86400` |
| `repos_output.json` | Generated — never hand-edit. Structure: `username/total_repos/generated_at/profile/repos[]` |

## Conventions

- `app.js`: all repo-derived strings go through `escapeHTML()` before template insertion. `repo.url` in `href` too — GitHub API is trusted, keep it that way
- No `console.log` in production code (rules)
- Git: commits signed with SSH key (global `commit.gpgsign=true`). Attribution disabled globally
- `.omc/` is local tooling junk — never commit

## Verify after edits

```bash
node --check app.js          # JS syntax
python -m py_compile fetch_stars.py   # Python syntax
python -c "import json; json.load(open('repos_output.json'))"  # data parses
```

## Known behavior

- Live site can lag repo: Vercel edge-caches `repos_output.json` up to `max-age` + SWR window. A push redeploys, but a cached JSON may serve up to ~1h old — not "real time"
- Cached JSON age on Vercel shows as `X-Vercel-Cache: HIT` + `Age` header. Diagnose staleness with `curl -sI .../repos_output.json`
