# Usage — Humans and AI Agents

Two audiences: people browsing the page, and agents querying the snapshot.

## 1. For Humans

Live site: **https://my-starred-repos.vercel.app/**

### Keyboard

| Key | Action |
|---|---|
| `/` | Focus search |
| `j` / `k` | Move selection down / up |
| `Enter` | Open the selected repo |
| `Escape` | Clear search and matcher filter |

### Filtering

Search is a case-insensitive substring match on name, description, language, and topics. Category tabs narrow by topic; the language dropdown filters on primary language; sort offers stars (both directions), name, and last update. Clicking a topic pill in the curation section applies that search term.

### Views

Compact list is the default: one hairline row per repo, best for scanning hundreds of entries. Grid shows cards with description, language, and update date. The choice is saved in `localStorage` under `starred_view_mode`.

### Pins and clone

The pin button on a card or row saves the repo under the **Pinned** tab. The copy button puts `git clone <url>.git` on the clipboard. Pins live in `localStorage` under `starred_pinned`, no account, nothing sent anywhere.

### Project matcher

Open **Project Matcher**, paste a README, idea, or stack list, run it. The page scores every repo client-side: weighted overlap on topics, name, language, category, and description, plus a small boost for star count. The percentage is relative to the best match in the current dataset, so `98%` means "closest fit here", not a quality grade. Nothing you paste leaves the page.

### Staleness

The header badge shows how old the snapshot is (`snapshot today`, `snapshot 12d old`). The data is regenerated when someone runs the sync script, so a stale badge is expected between runs.

## 2. For AI Agents

### Search API

```http
GET https://my-starred-repos.vercel.app/api/search?q={query}&category={category}&lang={lang}&limit={limit}&offset={offset}&sort={sort}
```

| Parameter | Default | Notes |
|---|---|---|
| `q` | none | Space-separated terms, all must appear somewhere in the record |
| `category` | all | Display name (`AI & Agents`, `Dev Tools`, ...) or slug (`ai`, `dev-tools`, `web-automation`, `llm-rag`, `web-dev`, `databases`, `devops`, `security`, `mobile`, `media`, `other`) |
| `lang` | all | Primary language, case-insensitive |
| `limit` | 20 | Clamped to 1–100 |
| `offset` | 0 | Use with `next_offset` from the previous response |
| `sort` | `stars-desc` | `stars-desc`, `stars-asc`, `name-asc`, `updated-desc` |

Empty or `all` filters mean "no filter". An unknown `sort` or `category` returns `400` with the allowed values instead of silently returning nothing. Only `GET` is accepted; anything else returns `405`.

```bash
curl -s "https://my-starred-repos.vercel.app/api/search?q=mcp&limit=5"
curl -s "https://my-starred-repos.vercel.app/api/search?category=dev-tools&lang=rust&limit=10&offset=10"
```

Every response carries `generated_at`, `data_age_seconds`, `total_matches`, and `next_offset`, and the same age in the `X-Data-Age` header. Check it before treating the data as current.

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

### Text endpoints

| Endpoint | Content |
|---|---|
| [`/llms.txt`](https://my-starred-repos.vercel.app/llms.txt) | Dataset metadata, topic taxonomy, top 100 repos |
| [`/llms-full.txt`](https://my-starred-repos.vercel.app/llms-full.txt) | Every repo with stars, language, and category |

Both files open with the same metadata block (`schema_version`, `total_repos`, `generated_at`, `sync_mode`). Per-category text files were retired in v0.3; the API covers those queries with filters.

### Tool definition

For a Claude Code, Cursor, or Codex tool wrapper:

```json
{
  "name": "search_starred_repos",
  "description": "Search a curated index of 1,350+ GitHub repositories across AI agents, MCP, Rust CLI, Android internals, and developer tools by Akash Priyadarshi.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Stack keywords, e.g. 'mcp server', 'rust grep'" },
      "category": { "type": "string", "description": "Optional: 'AI & Agents', 'Dev Tools', 'Mobile', 'Security', ... or a slug" },
      "limit": { "type": "number", "description": "Max results, 1-100 (default 20)" }
    },
    "required": ["query"]
  }
}
```

### Python

```python
import urllib.parse, urllib.request, json

def search_starred_repos(query: str, limit: int = 10) -> list:
    url = f"https://my-starred-repos.vercel.app/api/search?q={urllib.parse.quote(query)}&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "AIAgent/1.0"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        return data.get("results", [])

for repo in search_starred_repos("mcp server"):
    print(f"- {repo['full_name']} ({repo['stars']} stars): {repo['description']}")
```
