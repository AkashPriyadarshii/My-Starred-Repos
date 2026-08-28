# My Starred Repos — v0.2

A curated directory and agent-ready knowledge hub of 960+ GitHub starred repositories by **Akash Priyadarshi** — categorized, searchable, with zero-latency project matching and machine-readable context.

**[Live Site](https://my-starred-repos.vercel.app/)** &bull; **[LLM Index](https://my-starred-repos.vercel.app/llms.txt)** &bull; **[Search API](https://my-starred-repos.vercel.app/api/search?q=mcp)**

---

## 👤 For Humans

- **Compact List / Table View** — Toggle between card grid and dense single-line table mode for rapid scanning across 960+ repos.
- **Local Bookmarks & Pinned Tab** — Pin repositories with one click (stored in `localStorage`), switch to the "📌 Pinned" tab anytime to review your shortlist.
- **One-Click `git clone`** — Quick copy button on every card/row copies `git clone <url>.git` directly to clipboard.
- **Live Search & Filter** — Instant substring search (`/` shortcut), language filtering, and star/updated sorting.
- **Topic Clusters** — Curated clickable search pills (AI Agents, MCP, Claude Skills, RAG, Rust CLI, Android Internals, etc.).

---

## 🤖 For AI Agents & Vibe Coders

- **Vibe Coder Project Matcher** — Built-in client-side relevance engine. Paste your project README, tech stack, or idea prompt to instantly calculate cosine/term-overlap match percentages across all 960+ repos. Zero latency, zero backend.
- **REST Search API** — Serverless edge search endpoint for agents, scripts, and MCP servers:
  ```http
  GET https://my-starred-repos.vercel.app/api/search?q=agent&category=ai&limit=10
  ```
- **Per-Category `llms-*.txt` Endpoints** — Fetch only the category slice your agent requires:
  - [`/llms.txt`](https://my-starred-repos.vercel.app/llms.txt) — Top 100 + search taxonomy + category manifest
  - [`/llms-full.txt`](https://my-starred-repos.vercel.app/llms-full.txt) — All 960+ repos with metadata
  - [`/llms-ai-agents.txt`](https://my-starred-repos.vercel.app/llms-ai-agents.txt) — AI & Agents
  - [`/llms-dev-tools.txt`](https://my-starred-repos.vercel.app/llms-dev-tools.txt) — Dev Tools & CLIs
  - [`/llms-mobile.txt`](https://my-starred-repos.vercel.app/llms-mobile.txt) — Android & Mobile
  - [`/llms-llm-rag.txt`](https://my-starred-repos.vercel.app/llms-llm-rag.txt) — RAG & Vector search
  - [`/llms-web-automation.txt`](https://my-starred-repos.vercel.app/llms-web-automation.txt) — Web scraping & Automation
  - [`/llms-security.txt`](https://my-starred-repos.vercel.app/llms-security.txt) — Security & Pentesting
- **MCP Server Compatibility** — Agents can register this repository's search API as a tool or query the structured `repos_output.json` directly.

---

## Categories Tracked

1. **AI & Agents** — Multi-agent frameworks, autonomous agents, Claude Code skills, MCP servers
2. **LLM & RAG** — Vector DBs, embeddings, knowledge graphs, prompt engines
3. **Dev Tools** — Rust CLI tools, compilers, debuggers, high-performance utilities
4. **Mobile** — Android internals, Kotlin, Jetpack Compose, TDLib, Flutter
5. **Web Automation** — Headless browsers, scrapers, crawler APIs
6. **Web Dev** — Next.js, React, Tailwind, backend frameworks
7. **Databases** — PostgreSQL, SQLite, Supabase, Redis, ORMs
8. **DevOps** — Docker, Kubernetes, CI/CD, GitHub Actions, Vercel
9. **Security** — Reverse engineering, forensics, penetration testing
10. **Media** — FFmpeg, audio/video processing, Whisper, speech-to-text

---

## Data Pipeline

1. **`fetch_stars.py`** — Pulls starred repos from GitHub API with rate-limit backoff, classifies categories by keyword, outputs `repos_output.json`.
2. **`build_site.py`** — Pre-renders `index.html` with SEO headers, ItemList JSON-LD, FAQ, and topic tags. Generates all category `llms-*.txt` and `sitemap.xml`.
3. **Weekly GitHub Action (`sync-stars.yml`)** — Runs auto-sync weekly on Sundays at midnight UTC (`cron: '0 0 * * 0'`), with `workflow_dispatch` for manual runs between 1–7 days.
4. **Dashboard** — Pure static vanilla JS SPA deployed on Vercel with edge caching.

---

## Local Development

```bash
# Verify scripts
python -m py_compile fetch_stars.py build_site.py
node --check app.js

# Regenerate site
python build_site.py

# Start local server
python3 -m http.server 8080
# Open http://localhost:8080
```

## License

CUSTOM
