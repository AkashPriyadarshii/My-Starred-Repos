# Usage Guide — For Humans & AI Agents

My-Starred-Repos is a dual-audience platform designed for developers discovering open-source software and AI agents fetching token-efficient, categorized project context.

---

## 👤 1. For Humans

### Interactive Web Dashboard
Visit the live site: **[https://my-starred-repos.vercel.app/](https://my-starred-repos.vercel.app/)**

### Keyboard Shortcuts
| Key | Action |
|---|---|
| `/` | Focus search bar instantly from anywhere on the page |
| `Esc` | Blur search bar and clear query if active |

### Discovery & Filtering
- **Fuzzy & Substring Search**: Type any package name, topic, or keyword to filter the 960+ repositories in real time.
- **Category Tabs**: Click any category (e.g. *AI & Agents*, *Dev Tools*, *Mobile*, *Security*) to narrow down projects.
- **Language Filter**: Use the language dropdown to filter strictly by primary language (Rust, Go, Python, Kotlin, TypeScript, Zig, etc.).
- **Popular Topic Badges**: Click any pre-rendered topic pill in the curation section (e.g., *MCP Servers*, *Claude Code Skills*, *Rust CLI*, *Android Internals*) to auto-apply that search term and scroll to results.

### View Modes
- **Card Grid View** (Default): Spacious card layout showing star count, language badge, description, and relative update date.
- **Compact Table View**: Single-line dense row mode ideal for power users scanning through hundreds of tools rapidly.
- View preference is automatically saved in `localStorage`.

### Local Bookmarks & Pinning
- Click the star icon (⭐ / 📌) on any card or compact row to pin the repository.
- Switch to the **📌 Pinned** category tab anytime to review your saved shortlist.
- All bookmarks persist locally in your browser (`localStorage`) with zero login or tracking.

### One-Click `git clone`
- Click the copy button (📋) on any repo to copy `git clone <repo-url>.git` directly to your clipboard.

### Vibe Coder Project Matcher
1. Click the **Project Matcher** button next to the search bar.
2. Paste your project README, tech stack idea, or problem description.
3. Click **Find Matching Repos**.
4. The client-side relevance engine calculates weighted keyword overlaps, topic matches, and semantic relevance scores across all 960+ repos, displaying match percentage pills (e.g. `98% Match`).

---

## 🤖 2. For AI Agents & Vibe Coders

### REST Search API Endpoint
AI agents, scripts, and automation tools can query the serverless search API with CORS enabled.

```http
GET https://my-starred-repos.vercel.app/api/search?q={query}&category={category}&lang={lang}&limit={limit}&sort={sort}
```

#### Query Parameters
| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | `""` | Search query across name, description, language, category, and topics |
| `category`| string | `"all"` | Filter by category — display names (`AI & Agents`, `Dev Tools`, `Mobile`, `Security`, `Web Automation`, `LLM & RAG`, `Web Dev`, `Other`, `Media`, `Databases`, `DevOps`) — slugs (`ai`, `dev-tools`, `web-automation`, `llm-rag`, `web-dev`) also accepted |
| `lang` | string | `"all"` | Filter by primary programming language (`rust`, `python`, `go`, etc.) |
| `limit` | number | `20` | Maximum number of records returned (1–100) |
| `sort` | string | `"stars-desc"` | Sorting order: `stars-desc`, `stars-asc`, `name-asc`, `updated-desc` |

#### Example cURL
```bash
curl -s "https://my-starred-repos.vercel.app/api/search?q=mcp&limit=5"
```

#### Sample Response JSON
```json
{
  "schema_version": "0.2",
  "total_tracked": 964,
  "total_matches": 42,
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

### Machine-Readable LLM Text Endpoints

Fetch token-optimized Markdown text files designed specifically for AI system prompts, context windows, and RAG pipelines:

| Endpoint | Content |
|---|---|
| [`https://my-starred-repos.vercel.app/llms.txt`](https://my-starred-repos.vercel.app/llms.txt) | Top 100 starred repos + Topic Taxonomy + Category Manifest |
| [`https://my-starred-repos.vercel.app/llms-full.txt`](https://my-starred-repos.vercel.app/llms-full.txt) | Complete collection of 960+ repos with metadata |
| [`https://my-starred-repos.vercel.app/llms-ai-agents.txt`](https://my-starred-repos.vercel.app/llms-ai-agents.txt) | AI & Agents category slice (539+ repos) |
| [`https://my-starred-repos.vercel.app/llms-dev-tools.txt`](https://my-starred-repos.vercel.app/llms-dev-tools.txt) | Dev Tools & CLI utilities slice |
| [`https://my-starred-repos.vercel.app/llms-mobile.txt`](https://my-starred-repos.vercel.app/llms-mobile.txt) | Android & Mobile internals slice |
| [`https://my-starred-repos.vercel.app/llms-web-automation.txt`](https://my-starred-repos.vercel.app/llms-web-automation.txt) | Web Scraping & Automation slice |
| [`https://my-starred-repos.vercel.app/llms-llm-rag.txt`](https://my-starred-repos.vercel.app/llms-llm-rag.txt) | LLM & RAG frameworks slice |
| [`https://my-starred-repos.vercel.app/llms-web-dev.txt`](https://my-starred-repos.vercel.app/llms-web-dev.txt) | Web Dev frameworks slice |
| [`https://my-starred-repos.vercel.app/llms-security.txt`](https://my-starred-repos.vercel.app/llms-security.txt) | Security & Pentesting slice |
| [`https://my-starred-repos.vercel.app/llms-other.txt`](https://my-starred-repos.vercel.app/llms-other.txt) | Other / Unclassified slice (207 repos) |
| [`https://my-starred-repos.vercel.app/llms-media.txt`](https://my-starred-repos.vercel.app/llms-media.txt) | Media & Video/Audio slice |
| [`https://my-starred-repos.vercel.app/llms-databases.txt`](https://my-starred-repos.vercel.app/llms-databases.txt) | Databases & ORMs slice |
| [`https://my-starred-repos.vercel.app/llms-devops.txt`](https://my-starred-repos.vercel.app/llms-devops.txt) | DevOps & Infra slice |

---

### MCP (Model Context Protocol) Server Configuration

To enable Claude Code, Cursor, Codex, or OpenClaw to search this repository directly, add the following tool definition to your MCP configuration or custom prompt:

```json
{
  "name": "search_starred_repos",
  "description": "Search 960+ hand-curated high-performance GitHub repositories across AI agents, MCP, Rust CLI, Android internals, and developer tools by Akash Priyadarshi.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query or stack keywords (e.g., 'mcp server', 'rust grep', 'android memory')"
      },
      "category": {
        "type": "string",
        "description": "Optional category filter: 'AI & Agents', 'Dev Tools', 'Mobile', 'Security', 'Web Automation', 'Other', 'Media', 'LLM & RAG', 'Web Dev', 'Databases', 'DevOps' (slugs like 'ai', 'dev-tools' also accepted)"
      },
      "limit": {
        "type": "number",
        "description": "Max results to return (default 10, max 50)"
      }
    },
    "required": ["query"]
  }
}
```

#### Python Quick Integration
```python
import urllib.parse, urllib.request, json

def search_starred_repos(query: str, limit: int = 10) -> list:
    url = f"https://my-starred-repos.vercel.app/api/search?q={urllib.parse.quote(query)}&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "AIAgent/1.0"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        return data.get("results", [])

# Example usage:
matches = search_starred_repos("mcp server")
for repo in matches:
    print(f"- {repo['full_name']} (★ {repo['stars']}): {repo['description']}")
```
