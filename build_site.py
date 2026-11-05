#!/usr/bin/env python3
"""Generate index.html + llms.txt + llms-full.txt + sitemap.xml from repos_output.json.

Generated files are committed; pushing to main is the deploy. There is no workflow
and no cron. Run `python fetch_stars.py && python build_site.py`, or
`python build_site.py --check` to verify the committed output still matches.
"""
import argparse
import hashlib
import html as _html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "repos_output.json"
INDEX = ROOT / "index.html"
LLMS = ROOT / "llms.txt"
LLMS_FULL = ROOT / "llms-full.txt"
SITEMAP = ROOT / "sitemap.xml"

# Cache versions derive from file bytes: a stale ?v= can no longer happen.
def asset_version(name):
    return hashlib.sha1((ROOT / name).read_bytes()).hexdigest()[:8]

CSS_V = asset_version("style.css")
JS_V = asset_version("app.js")

GITHUB = "https://github.com/AkashPriyadarshii"
PORTFOLIO = "https://akashpriyadarshi.is-a.dev"
X_PROFILE = "https://x.com/Akash__ydv001"
LINKEDIN = "https://www.linkedin.com/in/akashpriyadarshii"


def esc(s):
    return _html.escape(str(s or ""), quote=True)


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', str(s or '').lower()).strip('-')


def fmt_num(n):
    """Mirror app.js formatNum so the baked and hydrated values agree."""
    n = int(n or 0)
    if n >= 1_000_000_000:
        return f"{n / 1e9:.1f}".rstrip("0").rstrip(".") + "b"
    if n >= 1_000_000:
        return f"{n / 1e6:.1f}".rstrip("0").rstrip(".") + "m"
    if n >= 1000:
        return f"{n / 1000:.1f}".rstrip("0").rstrip(".") + "k"
    return str(n)


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


def render_featured_section(repos, date_mod):
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
          <p class="seo-def">my-starred-repos is a free, searchable index of {len(repos)} GitHub repositories starred by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">Akash Priyadarshi</a>, covering AI agents, MCP servers, Rust CLIs, RAG frameworks, and developer tools. The index is a baked snapshot of the public GitHub API, regenerated on demand. This build: {esc(date_mod)}.</p>
          <p class="seo-desc">{len(repos)} starred open-source projects by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">Akash Priyadarshi</a>, organized across {len(cats)} categories from a snapshot generated {esc(date_mod)}. Primary technologies: {langs}.</p>
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
              <h4 class="seo-faq-q">What is my-starred-repos?</h4>
              <p class="seo-faq-a">my-starred-repos is a free index of every GitHub repository starred by Akash Priyadarshi, searchable by keyword, category, and language, with a client-side Project Matcher that ranks tools against your own project description. New stars appear on the next sync run.</p>
            </div>
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">What are the best open-source AI agent and developer tool repositories in 2026?</h4>
              <p class="seo-faq-a">Top-rated repositories include multi-agent orchestration frameworks (LangGraph, CrewAI, AutoGen, Hermes-Agent), Model Context Protocol servers (MCP), agent skill ecosystems (Claude Code skills, Superpowers, ECC), type-safe LLM tools (Pydantic-AI), token-efficient CLI utilities (rustygrep, zcat, repomap), and local agent assistants (OpenClaw, Browser-Use).</p>
            </div>
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">How does the Project Matcher rank repositories?</h4>
              <p class="seo-faq-a">It scores every repository in the browser by keyword overlap across names, topics, languages, and descriptions, with a small boost for well-starred projects. Nothing you paste leaves the page, and scores are relative to the best match in the current dataset.</p>
            </div>
            <div class="seo-faq-item">
              <h4 class="seo-faq-q">How often is the repository index updated?</h4>
              <p class="seo-faq-a">There is no schedule. The owner re-runs the sync script against the public GitHub API and commits the result; the badge in the header shows how old the current snapshot is.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
"""


def render_noscript(repos, n=30):
    """Plain-HTML top-N list for no-JS crawlers and lightweight AI fetchers."""
    items = "".join(
        f'<li><a href="{esc(r.get("url"))}">{esc(r.get("full_name"))}</a> — {esc((r.get("description") or "No description provided.")[:140])}</li>'
        for r in sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:n]
    )
    return f"""
    <noscript>
      <nav aria-label="Top starred repositories">
        <h2>Top Starred Repositories</h2>
        <ul>{items}</ul>
      </nav>
    </noscript>
"""


def render_sitemap(date_mod):
    # Homepage only: crawl budget concentrates on the indexable page.
    # llms*.txt endpoints stay discoverable via footer links + robots.txt.
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://my-starred-repos.vercel.app/</loc>',
        f'    <lastmod>{date_mod}</lastmod>',
        '    <priority>1.0</priority>',
        '  </url>',
    ]
    lines.append('</urlset>\n')
    return '\n'.join(lines)


def render_index(d):
    repos = d.get("repos", [])
    profile = d.get("profile", {})
    count = d.get("total_repos") or len(repos)
    generated = d.get("generated_at", "")
    date_mod = generated[:10] if generated else datetime.utcnow().strftime("%Y-%m-%d")

    # Title: ~55 chars, exact count so SERP matches page copy (target 30-60)
    title = f"Starred Repos — {esc(profile.get('name') or 'Akash Priyadarshi')} | {count} Curated Stars"

    # Meta description: ~140 chars (target 120-160)
    desc = (
        f"{count} curated GitHub starred repos by {esc(profile.get('name') or 'Akash Priyadarshi')} — "
        "AI agents, MCP, dev tools, systems, LLMs & web dev. Snapshot refreshed on demand."
    )

    featured_html = render_featured_section(repos, date_mod)
    schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Starred Repos",
        "url": "https://my-starred-repos.vercel.app/",
        "description": desc,
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Web",
        "softwareVersion": "0.3.0",
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
            "vibe coding tools",
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
    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "What is my-starred-repos?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "my-starred-repos is a free index of every GitHub repository starred by Akash Priyadarshi, searchable by keyword, category, and language, with a client-side Project Matcher that ranks tools against your own project description. New stars appear on the next sync run.",
                },
            },
            {
                "@type": "Question",
                "name": "What are the best open-source AI agent and developer tool repositories in 2026?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Top-rated repositories include multi-agent orchestration frameworks (LangGraph, CrewAI, AutoGen, Hermes-Agent), Model Context Protocol servers (MCP), agent skill ecosystems (Claude Code skills, Superpowers, ECC), type-safe LLM tools (Pydantic-AI), token-efficient CLI utilities (rustygrep, zcat, repomap), and local agent assistants (OpenClaw, Browser-Use).",
                },
            },
            {
                "@type": "Question",
                "name": "How does the Project Matcher rank repositories?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "It scores every repository in the browser by keyword overlap across names, topics, languages, and descriptions, with a small boost for well-starred projects. Nothing you paste leaves the page, and scores are relative to the best match in the current dataset.",
                },
            },
            {
                "@type": "Question",
                "name": "How often is the repository index updated?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "There is no schedule. The owner re-runs the sync script against the public GitHub API and commits the result; the badge in the header shows how old the current snapshot is.",
                },
            },
        ],
    }
    faq_json = json.dumps(faq, ensure_ascii=False, separators=(",", ":"))
    noscript_html = render_noscript(repos)
    # Baked so the page shows real numbers before app.js runs (no-JS, crawlers).
    total_stars = sum(r.get("stars", 0) for r in repos)
    avg_stars = round(total_stars / len(repos)) if repos else 0
    top_lang = (top_langs(repos, 1) or ["—"])[0]
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{title}</title>

  <!-- Core SEO & Keywords -->
  <meta name="description" content="{esc(desc)}">
  <meta name="keywords" content="best github repositories to star, curated github repos 2026, ai agents github, open source developer tools, claude code skills, model context protocol, mcp servers list, vibe coding tools, rust cli tools, rag llm frameworks, system design primer, awesome lists github, android reverse engineering, web automation, terminal tools, akash priyadarshi">
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
  <script type="application/ld+json">{faq_json}</script>

  <!-- Favicon / manifest -->
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#16100b">
  <meta name="msapplication-TileColor" content="#16100b">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="style.css?v={CSS_V}">
  <script defer src="app.js?v={JS_V}"></script>
</head>
<body>

  <a href="#grid" class="skip-link">Skip to repository list</a>

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
          <span class="sync-badge" id="sync-badge" title="Baked snapshot of the GitHub API">
            <span class="sync-dot"></span>
            <span id="sync-label">snapshot</span>
          </span>
        </div>
      </div>
    </header>

    <!-- Metrics -->
    <section class="metrics" id="metrics">
      <div class="metric-card">
        <span class="metric-val" id="metric-stars">{fmt_num(total_stars)}</span>
        <span class="metric-label">total stars tracked</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-repos">{len(repos)}</span>
        <span class="metric-label">starred repos</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-lang">{esc(top_lang)}</span>
        <span class="metric-label">top language</span>
      </div>
      <div class="metric-card">
        <span class="metric-val" id="metric-avg">{fmt_num(avg_stars)}</span>
        <span class="metric-label">avg stars</span>
      </div>
    </section>

    <!-- Controls -->
    <section class="controls">
      <div class="controls-top">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="search" placeholder="Search repos, topics, tools (/ to focus)..." autocomplete="off" aria-label="Search repositories">
          <button id="search-clear" class="search-clear hidden" aria-label="Clear search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="controls-right">
          <button id="matcher-toggle-btn" class="btn-matcher" title="Match starred tools to your project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
            <span>Project Matcher</span>
          </button>
          <select id="lang-filter" aria-label="Filter by language">
            <option value="all">All languages</option>
          </select>
          <select id="sort" aria-label="Sort repositories">
            <option value="stars-desc">Stars: high to low</option>
            <option value="stars-asc">Stars: low to high</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="updated-desc">Recently updated</option>
          </select>
          <div class="view-toggle" role="group" aria-label="View mode">
            <button id="view-grid-btn" class="view-btn" title="Card grid view" aria-label="Grid view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
            <button id="view-compact-btn" class="view-btn active" title="Compact list view" aria-label="Compact view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Project Matcher Drawer -->
      <div id="matcher-panel" class="matcher-panel hidden">
        <div class="matcher-header">
          <div class="matcher-title-wrap">
            <h2 class="matcher-title">Project Relevance Matcher</h2>
          </div>
          <button id="matcher-close-btn" class="matcher-close-btn" aria-label="Close project matcher">&times;</button>
        </div>
        <p class="matcher-desc">Paste your README, tech stack requirements, or idea description. The matcher scores every starred repo by keyword overlap, client-side, with no request leaving the page.</p>
        <div class="matcher-input-wrap">
          <textarea id="matcher-input" placeholder="e.g. Building an offline-first Android expense tracker in Kotlin with local SQLite and auto SMS extraction... or A multi-agent AI coding harness with Claude Code MCP servers and token-efficient Rust CLI tools..." rows="3"></textarea>
          <div class="matcher-actions">
            <button id="matcher-submit-btn" class="matcher-btn-primary">Find Matching Repos</button>
            <button id="matcher-reset-btn" class="matcher-btn-secondary">Clear</button>
            <span id="matcher-status" class="matcher-status"></span>
          </div>
          <div class="matcher-chips-wrap">
            <span class="matcher-chips-label">Quick Ideas:</span>
            <button class="matcher-chip" data-prompt="Multi-agent orchestration Claude Code MCP servers tools">Multi-Agent &amp; MCP</button>
            <button class="matcher-chip" data-prompt="Rust CLI high performance token efficient terminal utilities">Rust CLI &amp; Performance</button>
            <button class="matcher-chip" data-prompt="Offline-first Android Kotlin Jetpack Compose SQLite">Android &amp; Kotlin</button>
            <button class="matcher-chip" data-prompt="Web crawling headless browser scraping anti-bot">Web Scraping</button>
            <button class="matcher-chip" data-prompt="Local RAG embeddings vector database search">RAG &amp; Vector DBs</button>
          </div>
        </div>
      </div>

      <div class="controls-bottom">
        <div class="category-tabs" id="category-tabs" role="tablist" aria-label="Filter by category">
          <button class="cat-tab active" data-cat="all" role="tab" aria-selected="true">All</button>
          <button class="cat-tab cat-tab-pinned" data-cat="pinned" role="tab" aria-selected="false">Pinned (<span id="pinned-count">0</span>)</button>
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

    {noscript_html}

    <!-- Empty state -->
    <div class="empty-state hidden" id="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <p>No repos match your filters</p>
      <button class="empty-reset" id="empty-reset">Clear filters</button>
    </div>

    {featured_html}

    <!-- Toast notification for copy / pin actions -->
    <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-content">
        <p class="footer-text">Starred Repos v0.3 by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">{esc(profile.get('name') or 'Akash Priyadarshi')}</a>. Baked snapshot, refreshed on demand. <a href="/llms.txt" target="_blank" class="footer-link">llms.txt</a> &bull; <a href="/llms-full.txt" target="_blank" class="footer-link">llms-full.txt</a> &bull; <a href="/api/search?q=agent" target="_blank" class="footer-link">API</a></p>
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


def llms_lines(repos, meta, full=False, limit=100):
    lines = [
        "# Starred Repos",
        "",
        "> A curated collection of GitHub starred repositories by Akash Priyadarshi (AkashPriyadarshii),",
        "> organized by topic. This file is a baked snapshot, not a live feed.",
        "",
        "## Dataset",
        "",
        f"- schema_version: {meta.get('schema_version', 1)}",
        f"- total_repos: {meta.get('total_repos', len(repos))}",
        f"- generated_at: {meta.get('generated_at', 'unknown')}",
        f"- sync_mode: {meta.get('sync_mode', 'full')}",
        "- freshness: regenerated on demand (no schedule, no cron). Treat generated_at as the truth.",
        "- search_api: https://my-starred-repos.vercel.app/api/search?q=agent",
        "- full_index: https://my-starred-repos.vercel.app/llms-full.txt",
        "",
    ]

    if not full:
        lines.extend([
            "## Topic Taxonomy",
            "",
            "- AI Agents & Multi-Agent Orchestration (LangGraph, CrewAI, AutoGen, Hermes-Agent, Pydantic-AI)",
            "- Model Context Protocol (MCP) & Coding Skills (Claude Code Skills, MCP Servers, Superpowers, ECC)",
            "- High-Performance Systems & CLI Utilities (Rust, Zig, Go, token-efficient grep/cat/repomap)",
            "- LLM & RAG Infrastructure (RAGFlow, vLLM, Open-WebUI, Firecrawl)",
            "- Developer Productivity & System Design (system-design-primer, awesome-lists, scrcpy)",
            "- Mobile & Android Internals (Android reverse engineering, offline-first Flutter/Kotlin)",
            "",
        ])

    lines.append("## Repositories")
    lines.append("")

    repos = sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:limit]
    for r in repos:
        name = r.get("full_name", "")
        url = r.get("url", "")
        desc = (r.get("description") or "").strip()
        if full:
            meta_cols = f" [{r.get('stars', 0)} stars, {r.get('language') or 'N/A'}, {r.get('category') or 'Other'}]"
            lines.append(f"- [{name}]({url}): {desc}{meta_cols}")
        else:
            short = clean_summary(desc)
            lines.append(f"- [{name}]({url}): {short}")
    return "\n".join(lines) + "\n"


def build_outputs():
    d = load()
    repos = d.get("repos", [])
    generated = d.get("generated_at", "")
    date_mod = generated[:10] if generated else datetime.utcnow().strftime("%Y-%m-%d")

    outputs = {
        INDEX: render_index(d),
        LLMS: llms_lines(repos, d, full=False, limit=100),
        LLMS_FULL: llms_lines(repos, d, full=True, limit=len(repos)),
        SITEMAP: render_sitemap(date_mod),
    }
    # Per-category llms files were retired in 0.3: /api/search answers those queries.
    stale = [p for p in sorted(ROOT.glob("llms-*.txt")) if p.name != LLMS_FULL.name]
    return outputs, stale, len(repos), date_mod


def main():
    parser = argparse.ArgumentParser(
        description="Generate index.html, llms.txt, llms-full.txt, sitemap.xml from repos_output.json."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify committed output matches the generator; exit 1 on drift",
    )
    args = parser.parse_args()

    outputs, stale, repo_count, date_mod = build_outputs()

    if args.check:
        drift = [p for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        drift += stale
        if drift:
            print("DRIFT: " + ", ".join(p.name for p in drift))
            print("Run: python build_site.py")
            return 1
        print(f"OK: {len(outputs)} generated files match repos_output.json")
        return 0

    for path, text in outputs.items():
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"{path.name} ({len(text)} bytes)")
    for path in stale:
        path.unlink()
        print(f"removed stale {path.name}")
    print(f"{repo_count} repos, snapshot {date_mod}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
