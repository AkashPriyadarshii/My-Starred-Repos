# My Starred Repos

A curated dashboard of 550+ GitHub starred repositories — categorized, searchable, and auto-updated daily.

**[Live Site](https://my-starred-repos.vercel.app/dashboard/)**

## What

Every repo I've starred on GitHub, organized into categories:

- AI & Agents
- Systems & Dev Tools
- Mobile Development
- Web Development
- Databases & APIs
- LLM & RAG
- DevOps & Infra
- Security & Pentesting
- Design & UI/UX
- Media & Content
- Web Automation

## How it works

1. **`fetch_stars.py`** — Pulls all starred repos from GitHub API, categorizes them by keywords, outputs `repos_output.json`
2. **GitHub Actions** — Runs daily via `sync-stars.yml`, commits fresh data
3. **Dashboard** — Static SPA reads `repos_output.json`, renders cards with search/filter/sort

No backend. No database. No auth. Just a site.

## Tech

- Vanilla HTML/CSS/JS (no frameworks)
- CSS Grid + custom properties
- Geist font
- Deployed on Vercel

## Local dev

```bash
python3 -m http.server 8080
# open http://localhost:8080/dashboard/
```

## License

CUSTOM

