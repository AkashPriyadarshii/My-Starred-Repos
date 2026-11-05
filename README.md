<div align="center">

# My Starred Repos — v0.3

**A static index of every GitHub repository starred by [Akash Priyadarshi](https://akashpriyadarshi.is-a.dev), organized by topic, readable by humans and by AI agents.**

[Live site](https://my-starred-repos.vercel.app/) &bull; [USAGE.md](USAGE.md) &bull; [CHANGELOG.md](CHANGELOG.md)

</div>

1,353 repositories, 30.1m combined stars. The page is a baked snapshot: `repos_output.json` is generated on demand, `build_site.py` turns it into static HTML, and Vercel serves the result. There is no database, no build step on the server, and no cron job. Pushing to `main` deploys.

## What you get

- **One static page** with category tabs, search, language filter, sort, and a grid or compact list view.
- **Project matcher**: paste a project description, get the repos whose names, topics, languages, and descriptions overlap it. Weighted keyword overlap plus a small star boost, all client-side. Scores are relative to the best match in the current dataset, not absolute quality.
- **Pins and `git clone` copy**, stored in `localStorage`. Nothing leaves the browser.
- **Keyboard**: `/` focuses search, `j`/`k` move, `Enter` opens, `Escape` resets.
- **Machine context** at [`/llms.txt`](https://my-starred-repos.vercel.app/llms.txt) (top 100 + taxonomy) and [`/llms-full.txt`](https://my-starred-repos.vercel.app/llms-full.txt) (all repos, full metadata).

## Data pipeline

```
GitHub public API -> fetch_stars.py -> repos_output.json -> build_site.py -> index.html, llms*.txt, sitemap.xml
                                                                          -> /api/search reads repos_output.json
```

```bash
python fetch_stars.py              # full sync (default): refresh everything, prune unstars
python fetch_stars.py --incremental  # stop at the first known repo; new stars only, keeps stale metadata
python build_site.py               # regenerate index.html, llms.txt, llms-full.txt, sitemap.xml
python build_site.py --check       # exit 1 if the committed output is stale
```

`fetch_stars.py` needs no token. It uses the unauthenticated public API, so a full sync costs one request per 100 starred repos against the shared IP rate limit. `repos_output.json` records `schema_version`, `generated_at`, `sync_mode`, `requests_used`, and a per-repo `synced_at` so the age of the snapshot (and of any kept-from-last-time repo) is visible rather than assumed.

`build_site.py` is the only writer of `index.html`, `llms.txt`, `llms-full.txt`, and `sitemap.xml`. Never hand-edit them.

## REST search API

```http
GET /api/search?q={query}&category={category}&lang={lang}&limit={n}&offset={n}&sort={sort}
```

- `q` — space-separated terms, all must appear in name, description, language, category, or topics.
- `category` — display name or slug (`ai`, `dev-tools`, `web-automation`, `llm-rag`, `web-dev`, `databases`, `devops`, `security`, `mobile`, `media`, `other`).
- `lang`, `sort` (`stars-desc`, `stars-asc`, `name-asc`, `updated-desc`), `limit` (1–100), `offset`.
- An absent, empty, or `all` filter means "no filter". Unknown `sort` or `category` returns `400` with the allowed values.

```bash
curl -s "https://my-starred-repos.vercel.app/api/search?q=mcp&limit=5"
curl -s "https://my-starred-repos.vercel.app/api/search?category=dev-tools&lang=rust&limit=10"
```

Response:

```json
{
  "schema_version": 1,
  "generated_at": "2026-11-05T14:20:11+05:30",
  "data_age_seconds": 90321,
  "sync_mode": "full",
  "total_tracked": 1353,
  "total_matches": 42,
  "limit": 5,
  "offset": 0,
  "next_offset": 5,
  "query": "mcp",
  "category": null,
  "language": null,
  "sort": "stars-desc",
  "results": []
}
```

Every response carries the snapshot age, and the same value appears in the `X-Data-Age` header, so a caller can decide whether the data is fresh enough. Only `GET` is supported; other methods return `405`.

## Files

| File | Role |
|---|---|
| `fetch_stars.py` | Pulls starred repos from the public GitHub API, writes `repos_output.json` |
| `build_site.py` | Renders `index.html`, `llms.txt`, `llms-full.txt`, `sitemap.xml`; `--check` detects drift |
| `app.js` | Client: fetch, filter, sort, render, matcher, pins |
| `style.css` | Warm charcoal and amber theme, OKLCH tokens |
| `api/search.js` | Serverless search over the JSON snapshot |
| `generate_assets.py` | Icons, favicon, OG image; only needed when the brand changes |
| `repos_output.json` | Dataset. Generated. Never hand-edit |
| `vercel.json` | Clean URLs, security headers, cache policy |

## Verify

```bash
node --check app.js api/search.js
python -m py_compile fetch_stars.py build_site.py generate_assets.py
python build_site.py --check
python -m unittest discover -s tests -v
node --test tests/test_api_search.mjs
```

## License

CUSTOM. Built by [Akash Priyadarshi](https://github.com/AkashPriyadarshii).
