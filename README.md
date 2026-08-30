<div align="center">

# ⭐ My Starred Repos — v0.2
### *Curated Open-Source Directory & Machine-Readable Knowledge Hub*

[![Live Site](https://img.shields.io/badge/Live%20Site-my--starred--repos.vercel.app-34d399?style=flat-square&logo=vercel)](https://my-starred-repos.vercel.app/)
[![LLM Context](https://img.shields.io/badge/LLM%20Endpoint-/llms.txt-38bdf8?style=flat-square&logo=openai)](https://my-starred-repos.vercel.app/llms.txt)
[![Search API](https://img.shields.io/badge/REST%20API-/api/search-a78bfa?style=flat-square)](https://my-starred-repos.vercel.app/api/search?q=mcp)
[![Weekly Sync](https://img.shields.io/badge/Sync-Weekly%20%2B%20On--Demand-emerald?style=flat-square&logo=github-actions)](https://github.com/AkashPriyadarshii/My-Starred-Repos/actions)
[![License](https://img.shields.io/badge/License-CUSTOM-gray?style=flat-square)](#license)

**960+ hand-curated, production-tested GitHub repositories curated by [Akash Priyadarshi](https://github.com/AkashPriyadarshii).**  
*Optimized for human developers exploring top tools and autonomous AI coding agents (Claude Code, Codex, Cursor, OpenClaw) needing instant, token-efficient project context.*

[Explore Web Dashboard](https://my-starred-repos.vercel.app/) &bull; [Read USAGE.md](USAGE.md) &bull; [API Reference](#-rest-search-api) &bull; [Categories Manifest](#-categories-manifest)

</div>

---

## ⚡ Highlights

| 👤 For Humans | 🤖 For AI Agents & Vibe Coders |
|---|---|
| **Compact List & Card Modes** — Dense single-line table view vs modern card grid | **Vibe Coder Project Matcher** — Zero-latency client-side relevance engine matching your README/idea to top repos |
| **Local Bookmarks & Pinning** — Save your shortlist to `localStorage` with zero login | **REST Search API** — Serverless `/api/search` endpoint with CORS for instant agent queries |
| **1-Click `git clone` Copy** — Instant clone commands copied directly to clipboard | **Per-Category `llms-*.txt`** — Dedicated token-optimized endpoints for individual domains |
| **Instant Substring Search** — Fuzzy search with `/` keyboard shortcut and live filter | **MCP Compatibility** — Drop-in tool definitions for Model Context Protocol agents |
| **Topic Clusters Matrix** — Clickable tags (AI Agents, MCP, Claude Skills, Rust CLI, Android) | **Zero-Cost Architecture** — Vanilla JS + Edge serverless, zero database, zero external dependencies |

---

## 🧭 Live Web Dashboard Features

- **Bloom warm-amber "aura" theme**: atmospheric dark UI with drifting amber/coral blooms, film grain, giant weighty-sans display type (Inter Tight) + Instrument Serif accent, and refined shadcn-grade controls.
- **Project Relevance Matcher**: Paste your project idea or README. The client-side engine calculates TF-IDF and weighted keyword overlap scores, ranking the top matching tools with percentage match pills (e.g. `98% Match`).
- **Keyboard-First Navigation**: Press `/` anywhere to focus search; press `Escape` to reset.
- **Progressive Batch Rendering**: `IntersectionObserver` renders 60 cards per chunk, reducing initial DOM nodes from 7,100+ to ~450 for silky smooth 60fps scrolling and optimal Core Web Vitals (INP/LCP).
- **SEO & GEO Optimizations**: Valid Schema.org JSON-LD graph (`WebApplication` + `Person` entity graph), pre-rendered FAQ citation block for Google AI Overviews & Perplexity, and XML sitemaps.

---

## 📡 REST Search API

Agents, scripts, and CLI tools can query the serverless endpoint directly:

```http
GET https://my-starred-repos.vercel.app/api/search?q={query}&category={category}&lang={lang}&limit={limit}
```

### Example Requests

```bash
# Query AI agent and MCP tools
curl -s "https://my-starred-repos.vercel.app/api/search?q=mcp&limit=5"

# Query high-performance Rust tools ( slugs like dev-tools / ai auto-normalize to display names )
curl -s "https://my-starred-repos.vercel.app/api/search?category=dev-tools&lang=rust&limit=10"
```

### Response Schema

```json
{
  "schema_version": "0.2",
  "total_tracked": 964,
  "total_matches": 15,
  "limit": 5,
  "query": "mcp",
  "category": null,
  "language": null,
  "results": [
    {
      "full_name": "modelcontextprotocol/servers",
      "stars": 45120,
      "language": "TypeScript",
      "description": "Model Context Protocol Servers",
      "category": "AI & Agents",
      "url": "https://github.com/modelcontextprotocol/servers",
      "last_updated": "2026-08-27T10:14:02Z",
      "license": "MIT",
      "forks": 4120,
      "topics": ["ai", "mcp", "agent", "protocol"]
    }
  ]
}
```

---

## 🤖 Model Context Protocol (MCP) Tool Integration

Add this tool definition to Claude Code, Cursor, or your MCP agent configuration:

```json
{
  "name": "search_starred_repos",
  "description": "Search 960+ hand-curated high-performance GitHub repositories across AI agents, MCP, Rust CLI, Android internals, and developer tools.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (e.g. 'mcp server', 'rust grep', 'android binder')"
      },
      "category": {
        "type": "string",
        "description": "Optional category: 'AI & Agents', 'Dev Tools', 'Mobile', 'Security', 'Web Automation', 'LLM & RAG', 'Web Dev', 'Other', 'Media', 'Databases', 'DevOps' (slugs like 'ai', 'dev-tools' also accepted)"
      },
      "limit": {
        "type": "number",
        "description": "Max results (1-50, default 10)"
      }
    },
    "required": ["query"]
  }
}
```

---

## 📚 Machine Context (`llms.txt`) Endpoints

| Endpoint | Description |
|---|---|
| [`/llms.txt`](https://my-starred-repos.vercel.app/llms.txt) | Top 100 Starred Repos + Topic Taxonomy + Category Manifest |
| [`/llms-full.txt`](https://my-starred-repos.vercel.app/llms-full.txt) | All 960+ Starred Repos with full metadata |
| [`/llms-ai-agents.txt`](https://my-starred-repos.vercel.app/llms-ai-agents.txt) | AI & Agents Category (539 repos) |
| [`/llms-dev-tools.txt`](https://my-starred-repos.vercel.app/llms-dev-tools.txt) | Dev Tools & CLI Utilities (74 repos) |
| [`/llms-mobile.txt`](https://my-starred-repos.vercel.app/llms-mobile.txt) | Android & Mobile Internals (50 repos) |
| [`/llms-web-automation.txt`](https://my-starred-repos.vercel.app/llms-web-automation.txt) | Web Automation & Scraping (29 repos) |
| [`/llms-llm-rag.txt`](https://my-starred-repos.vercel.app/llms-llm-rag.txt) | LLM & RAG Frameworks (16 repos) |
| [`/llms-web-dev.txt`](https://my-starred-repos.vercel.app/llms-web-dev.txt) | Web Dev Frameworks (11 repos) |
| [`/llms-security.txt`](https://my-starred-repos.vercel.app/llms-security.txt) | Security & Pentesting (10 repos) |
| [`/llms-other.txt`](https://my-starred-repos.vercel.app/llms-other.txt) | Other / Unclassified (207 repos) |
| [`/llms-media.txt`](https://my-starred-repos.vercel.app/llms-media.txt) | Media & Video/Audio (21 repos) |
| [`/llms-databases.txt`](https://my-starred-repos.vercel.app/llms-databases.txt) | Databases & ORMs (2 repos) |
| [`/llms-devops.txt`](https://my-starred-repos.vercel.app/llms-devops.txt) | DevOps & Infra (5 repos) |

---

## 🗂️ Categories Manifest

| Category | Repos | Primary Technologies | Description |
|---|---|---|---|
| **AI & Agents** | 530+ | Python, TypeScript, Rust | Multi-agent frameworks, Claude Code skills, MCP servers, autonomous agents |
| **Dev Tools** | 70+ | Rust, Zig, Go, C++ | High-performance CLI tools, terminal emulators, compilers, token-efficient tools |
| **Mobile** | 50+ | Kotlin, Dart, Swift | Android internals, TDLib native builds, Flutter offline-first architecture |
| **Web Automation** | 30+ | TypeScript, Python | Headless browsers, crawler APIs, anti-bot scrapers, Playwright utilities |
| **LLM & RAG** | 16+ | Python, TypeScript | Vector embeddings, RAG pipelines, semantic search engines |
| **Web Dev** | 11+ | Next.js, React, Tailwind | Full-stack frameworks, design systems, modern web tools |
| **Security** | 10+ | Rust, Python, Go | Reverse engineering, forensics, memory inspection, vulnerability testing |
| **DevOps & DBs** | 10+ | Go, Shell, SQL | Docker, Kubernetes, SQLite/Postgres ORMs, infrastructure as code |

---

## 🏗️ Architecture & Data Pipeline

```
GitHub API (User Stars)
         │
         ▼
 ┌─────────────────┐
 │ fetch_stars.py  │ ◄─── Auto-syncs weekly (Sunday 00:00 UTC) + on-demand
 └────────┬────────┘
          │
          ▼ writes repos_output.json (Single Source of Truth)
 ┌─────────────────┐
 │  build_site.py  │ ───► index.html (Baked SEO + Project Matcher UI)
 └────────┬────────┘ ───► llms.txt, llms-full.txt, llms-*.txt
          │          ───► sitemap.xml
          ▼
 Vercel Edge CDN + Serverless API (/api/search)
```

---

## 💻 Local Development

```bash
# 1. Verify script syntax
node --check app.js api/search.js
python -m py_compile fetch_stars.py build_site.py generate_assets.py

# 2. Rebuild site artifacts
python build_site.py

# 3. Start local development server
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## 📄 License

CUSTOM &bull; Built with pride by [Akash Priyadarshi](https://github.com/AkashPriyadarshii).
