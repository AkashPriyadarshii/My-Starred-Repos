#!/usr/bin/env python3
"""Generate index.html + llms.txt + llms-full.txt + sitemap.xml from repos_output.json.

Run after fetch_stars.py. Repos_output.json stays the single source of truth;
this script bakes SEO-critical content into index.html so non-JS crawlers and
AI answer engines get real content, not an empty shell.
"""
import html as _html
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "repos_output.json"
INDEX = ROOT / "index.html"
LLMS = ROOT / "llms.txt"
LLMS_FULL = ROOT / "llms-full.txt"
SITEMAP = ROOT / "sitemap.xml"

CSS_V = "3"
JS_V = "4"

GITHUB = "https://github.com/AkashPriyadarshii"
PORTFOLIO = "https://akashpriyadarshi.vercel.app"
X_PROFILE = "https://x.com/Akash__ydv001"
LINKEDIN = "https://linkedin.com/in/akash-priyadarshi-1aa51b37a"


def esc(s):
    return _html.escape(str(s or ""), quote=True)


def count_label(n):
    return f"{int(n) // 10 * 10}+"


def load():
    with DATA.open(encoding="utf-8") as f:
        return json.load(f)


def top_langs(repos, top=5):
    counts = {}
    for r in repos:
        lang = r.get("language") or "Unknown"
        if lang != "Unknown":
            counts[lang] = counts.get(lang, 0) + 1
    return [lang for lang, _ in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)][:top]


def category_counts(repos):
    counts = {}
    for r in repos:
        cat = r.get("category") or "Other"
        counts[cat] = counts.get(cat, 0) + 1
    return sorted(counts.items(), key=lambda kv: kv[1], reverse=True)


def featured(repos, n=10):
    return sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:n]


def itemlist_json(repos, n=20):
    items = []
    for r in sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:n]:
        items.append({
            "@type": "ListItem",
            "position": len(items) + 1,
            "item": {
                "@type": "SoftwareSourceCode",
                "name": r.get("full_name", ""),
                "description": r.get("description"),
                "url": r.get("url"),
                "codeRepository": r.get("url"),
            },
        })
    return items


def render_featured_section(repos):
    cards = []
    for r in featured(repos):
        desc = r.get("description") or "No description provided."
        stars = f"{r.get('stars', 0):,}"
        lang = r.get("language") or "N/A"
        cards.append(
            '<li class="seo-repo">'
            '<div class="seo-repo-top">'
            f'<a href="{esc(r.get("url"))}" target="_blank" rel="noopener" class="seo-repo-name">{esc(r.get("full_name"))}</a>'
            f'<span class="seo-stars">★ {stars}</span>'
            f'<span class="seo-lang">{esc(lang)}</span>'
            '</div>'
            f'<p class="seo-repo-desc">{esc(desc)}</p>'
            '</li>'
        )
    cats = category_counts(repos)
    cat_html = "".join(
        f'<li class="seo-cat-item"><span class="seo-cat-name">{esc(cat)}</span><span class="seo-cat-count">{n}</span></li>'
        for cat, n in cats
    )
    langs = ", ".join(esc(l) for l in top_langs(repos))

    topic_clusters = [
        ("AI Agents & Multi-Agent", "agent"),
        ("Model Context Protocol (MCP)", "mcp"),
        ("Claude Code Skills", "claude"),
        ("LLM & RAG Pipelines", "rag"),
        ("Rust CLI & Systems", "rust"),
        ("Developer Tools & CLIs", "tool"),
        ("System Design & Architecture", "system design"),
        ("Android & Mobile Internals", "android"),
        ("Web Automation & Scraping", "automation"),
        ("Security & Pentesting", "security"),
    ]
    topics_html = "".join(
        f'<button class="seo-topic-badge" data-query="{esc(q)}">{esc(title)}</button>'
        for title, q in topic_clusters
    )

    return f"""
    <!-- Static SEO / E-E-A-T & Keyword Overview -->
    <section id="seo-content" class="seo-section" aria-label="Curated Repository Directory, Search Clusters &amp; FAQ">
      <div class="seo-card">
        <div class="seo-header">
          <h2>Curated GitHub Repositories &amp; Developer Tools</h2>
          <p class="seo-desc">{len(repos)} hand-curated open-source projects by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">Akash Priyadarshi</a>, organized across {len(cats)} categories and auto-updated daily via GitHub Actions. Primary technologies: {langs}.</p>
        </div>

        <div class="seo-topics-wrap">
          <h3>Popular Search Topics &amp; Clusters</h3>
          <div class="seo-topic-cloud">{topics_html}</div>
        </div>

        <div class="seo-about">
          <h3>Curation Philosophy &amp; Selection Criteria</h3>
          <p>Every repository in this index is selected for production utility, architectural clarity, and agentic leverage — prioritizing AI coding workflows, high-performance systems (Rust, Zig, Go), Android internals, and zero-dependency developer tooling.</p>
        </div>

        <div class="seo-grid-overview">
          <div class="seo-cats-block">
            <h3>Directory Categories</h3>
            <ul class="seo-cats-list">{cat_html}</ul>
          </div>
          <div class="seo-featured-block">
            <h3>Top Starred Highlights</h3>
            <ul class="seo-list">{''.join(cards)}</ul>
          </div>
        </div>

        <div class="seo-faq">
          <h3>Frequently Asked Questions</h3>
          <div class="seo-faq-grid">
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">What are the best open-source AI agent and developer tool repositories in 2026?</h4>
              <p class="seo-faq-a">Top-rated repositories in 2026 include multi-agent orchestration frameworks (LangGraph, CrewAI, AutoGen, Hermes-Agent), Model Context Protocol servers (MCP), agent skill ecosystems (Claude Code skills, Superpowers, ECC), type-safe LLM tools (Pydantic-AI), token-efficient CLI utilities (rustygrep, zcat, repomap), and local agent assistants (OpenClaw, Browser-Use).</p>
            </div>
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">How are these 890+ repositories selected and curated?</h4>
              <p class="seo-faq-a">Every repository is hand-selected by Akash Priyadarshi based on real-world utility, code quality, active maintenance, and engineering rigor — without sponsored placements or generic AI wrappers.</p>
            </div>
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">How often is the repository index updated?</h4>
              <p class="seo-faq-a">The dataset, star metrics, language taxonomies, and GitHub metadata are synchronized automatically every 24 hours via GitHub Actions workflows.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
"""


def render_sitemap(date_mod):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://my-starred-repos.vercel.app/</loc>
    <lastmod>{date_mod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
"""


def render_index(d):
    repos = d.get("repos", [])
    profile = d.get("profile", {})
    count = d.get("total_repos") or len(repos)
    generated = d.get("generated_at", "")
    date_mod = generated[:10] if generated else datetime.utcnow().strftime("%Y-%m-%d")
    
    # Title: ~53 chars (target 30-60)
    title = f"Starred Repos — {esc(profile.get('name') or 'Akash Priyadarshi')} | {count_label(count)} Curated Stars"
    
    # Meta description: ~152 chars (target 120-160)
    desc = (
        f"{count} curated GitHub starred repos by {esc(profile.get('name') or 'Akash Priyadarshi')} — "
        "AI agents, dev tools, systems, LLMs & web dev. Auto-updated daily via GitHub Actions. Search and explore."
    )
    
    featured_html = render_featured_section(repos)
    schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Starred Repos",
        "url": "https://my-starred-repos.vercel.app/",
        "description": desc,
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Web",
        "author": {
            "@type": "Person",
            "name": profile.get("name") or "Akash Priyadarshi",
            "alternateName": "AkashPriyadarshii",
            "url": GITHUB,
            "sameAs": [
                GITHUB,
                X_PROFILE,
                PORTFOLIO,
                LINKEDIN,
            ],
        },
        "keywords": [
            "best github repositories to star",
            "curated github repos 2026",
            "ai agents github",
            "open source developer tools",
            "claude code skills",
            "model context protocol",
            "mcp servers list",
            "rust cli tools",
            "llm and rag frameworks",
            "system design primer",
            "awesome lists github",
            "android reverse engineering",
            "web automation tools",
            "developer productivity tools",
            "akash priyadarshi"
        ],
        "dateModified": date_mod,
        "inLanguage": "en",
        "isAccessibleForFree": True,
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "about": {"@type": "ItemList", "itemListElement": itemlist_json(repos)},
    }
    schema_json = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{title}</title>

  <!-- Core SEO & Keywords -->
  <meta name="description" content="{esc(desc)}">
  <meta name="keywords" content="best github repositories to star, curated github repos 2026, ai agents github, open source developer tools, claude code skills, model context protocol, mcp servers list, rust cli tools, rag llm frameworks, system design primer, awesome lists github, android reverse engineering, web automation, terminal tools, akash priyadarshi">
  <meta name="author" content="{esc(profile.get('name') or 'Akash Priyadarshi')}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="https://my-starred-repos.vercel.app/">
  <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM Summary">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://my-starred-repos.vercel.app/">
  <meta property="og:title" content="{esc(profile.get('name') or 'Starred Repos')} — Starred Repos">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="https://my-starred-repos.vercel.app/icons/og-image.png">
  <meta property="og:image:alt" content="Starred Repos — {esc(profile.get('name') or 'Akash Priyadarshi')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Starred Repos">
  <meta property="og:locale" content="en_US">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://my-starred-repos.vercel.app/">
  <meta name="twitter:title" content="{esc(profile.get('name') or 'Starred Repos')} — Starred Repos">
  <meta name="twitter:description" content="{esc(desc)}">
  <meta name="twitter:image" content="https://my-starred-repos.vercel.app/icons/og-image.png">
  <meta name="twitter:image:alt" content="Starred Repos dashboard">
  <meta name="twitter:creator" content="@Akash__ydv001">

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">{schema_json}</script>

  <!-- Favicon / manifest -->
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#09090b">
  <meta name="msapplication-TileColor" content="#09090b">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="style.css?v={CSS_V}">
  <script defer src="app.js?v={JS_V}"></script>
</head>
<body>

  <div class="page">
    <header class="header">
      <div class="header-content">
        <div class="header-left">
          <a href="{esc(GITHUB)}" target="_blank" rel="noopener" class="avatar-link" aria-label="GitHub profile">
            <img id="profile-avatar" src="" alt="{esc(profile.get('name') or 'Akash Priyadarshi')}" class="avatar-img hidden" width="56" height="56">
            <div class="avatar-fallback" id="avatar-fallback">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path></svg>
            </div>
          </a>
          <div class="header-text">
            <h1 id="profile-name">{esc(profile.get('name') or 'Akash Priyadarshi')}</h1>
            <p class="header-bio" id="profile-bio">{esc(profile.get('bio') or 'Curated starred repositories')}</p>
          </div>
        </div>
        <div class="header-right">
          <div class="header-stats" id="header-stats">
            <div class="stat">
              <span class="stat-val" id="stat-followers">{profile.get('followers', '—')}</span>
              <span class="stat-label">followers</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-val" id="stat-repos">{profile.get('public_repos', '—')}</span>
              <span class="stat-label">repos</span>
            </div>
          </div>
          <span class="sync-badge" id="sync-badge" title="Profile synced live from GitHub API">
            <span class="sync-dot"></span>
            <span id="sync-label">syncing</span>
          </span>
        </div>
      </div>
    </header>

    <!-- Metrics -->
    <section class="metrics" id="metrics">
      <div class="metric-card">
        <span class="metric-val" id="metric-stars">—</span>
        <span class="metric-label">total stars tracked</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-repos">{len(repos)}</span>
        <span class="metric-label">starred repos</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-lang">—</span>
        <span class="metric-label">top language</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-avg">—</span>
        <span class="metric-label">avg stars</span>
      </div>
    </section>

    <!-- Controls -->
    <section class="controls">
      <div class="controls-top">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="search" placeholder="Search repos..." autocomplete="off" aria-label="Search repositories">
          <button id="search-clear" class="search-clear hidden" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="controls-right">
          <select id="lang-filter" aria-label="Filter by language">
            <option value="all">All languages</option>
          </select>
          <select id="sort" aria-label="Sort repositories">
            <option value="stars-desc">Stars: high to low</option>
            <option value="stars-asc">Stars: low to high</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="updated-desc">Recently updated</option>
          </select>
        </div>
      </div>
      <div class="controls-bottom">
        <div class="category-tabs" id="category-tabs" role="tablist" aria-label="Filter by category">
          <button class="cat-tab active" data-cat="all" role="tab" aria-selected="true">All</button>
        </div>
        <span class="result-count" id="result-count"></span>
      </div>
    </section>

    <!-- Grid -->
    <main class="grid" id="grid" role="list" aria-label="Repository cards">
      <div class="skeleton-grid" id="skeleton">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    </main>

    <!-- Empty state -->
    <div class="empty-state hidden" id="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <p>No repos match your filters</p>
      <button class="empty-reset" id="empty-reset">Clear filters</button>
    </div>

    {featured_html}

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <p class="footer-text">Built by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">{esc(profile.get('name') or 'Akash Priyadarshi')}</a>. Auto-updated daily via GitHub Actions.</p>
        <div class="visitor-counter" id="visitor-counter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="visitor-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          <span id="visitor-count">—</span> views
        </div>
      </div>
    </footer>
  </div>

</body>
</html>
"""


def clean_summary(desc):
    """Extract a concise single-clause summary without breaking abbreviations or filenames."""
    if not desc:
        return "No description"
    cleaned = desc.strip()
    # Sentence split: dot followed by space and uppercase letter, ignoring tiny prefixes (<20 chars, e.g. f.k.a.)
    for match in re.finditer(r'(?<=[a-z0-9\)])\.\s+[A-Z]', cleaned):
        if match.start() >= 20:
            cleaned = cleaned[:match.start() + 1]
            break
    # Remove em-dashes and trailing clauses if very long
    if " — " in cleaned and len(cleaned) > 60:
        cleaned = cleaned.split(" — ")[0]
    elif " - " in cleaned and len(cleaned) > 70:
        cleaned = cleaned.split(" - ")[0]
    cleaned = cleaned.strip()
    if len(cleaned) > 120:
        cleaned = cleaned[:117].rstrip() + "..."
    return cleaned


def llms_lines(repos, full=False, limit=100):
    lines = [
        "# Starred Repos",
        "",
        "> A curated collection of GitHub starred repositories by Akash Priyadarshi (AkashPriyadarshii),",
        "> organized by topic and auto-updated daily.",
        "",
        "## Search & Topic Taxonomy",
        "",
        "- AI Agents & Multi-Agent Orchestration (LangGraph, CrewAI, AutoGen, Hermes-Agent, Pydantic-AI)",
        "- Model Context Protocol (MCP) & Coding Skills (Claude Code Skills, MCP Servers, Superpowers, ECC)",
        "- High-Performance Systems & CLI Utilities (Rust, Zig, Go, token-efficient grep/cat/repomap)",
        "- LLM & RAG Infrastructure (RAGFlow, vLLM, Open-WebUI, Firecrawl)",
        "- Developer Productivity & System Design (system-design-primer, awesome-lists, scrcpy)",
        "- Mobile & Android Internals (Android reverse engineering, offline-first Flutter/Kotlin)",
        "",
        "## Repositories",
        "",
    ]
    repos = sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:limit]
    for r in repos:
        name = r.get("full_name", "")
        url = r.get("url", "")
        desc = (r.get("description") or "").strip()
        if full:
            meta = f" [{r.get('stars', 0)} stars, {r.get('language') or 'N/A'}, {r.get('category') or 'Other'}]"
            lines.append(f"- [{name}]({url}): {desc}{meta}")
        else:
            short = clean_summary(desc)
            lines.append(f"- [{name}]({url}): {short}")
    return "\n".join(lines) + "\n"


def main():
    d = load()
    repos = d.get("repos", [])
    generated = d.get("generated_at", "")
    date_mod = generated[:10] if generated else datetime.utcnow().strftime("%Y-%m-%d")

    INDEX.write_text(render_index(d), encoding="utf-8")
    LLMS.write_text(llms_lines(repos, full=False), encoding="utf-8")
    LLMS_FULL.write_text(llms_lines(repos, full=True, limit=len(repos)), encoding="utf-8")
    SITEMAP.write_text(render_sitemap(date_mod), encoding="utf-8")

    print(f"index.html ({len(repos)} repos, {len(repos)} baked)")
    print(f"llms.txt ({min(len(repos), 100)} entries)")
    print(f"llms-full.txt ({len(repos)} entries)")
    print(f"sitemap.xml (lastmod: {date_mod})")


if __name__ == "__main__":
    main()
