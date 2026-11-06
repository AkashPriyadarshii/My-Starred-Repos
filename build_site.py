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
                "description": strip_emoji(r.get("description")),
                "url": r.get("url"),
                "codeRepository": r.get("url"),
            },
        })
    return items


def render_about_section(repos, date_mod):
    cats = category_counts(repos)
    total_stars = sum(r.get("stars", 0) for r in repos)
    avg_stars = round(total_stars / len(repos)) if repos else 0
    langs = " · ".join(esc(l) for l in top_langs(repos, 3))

    return f"""
    <section class="about" id="about" aria-label="About this index">
      <div>
        <h2>About this index</h2>
        <p>my-starred-repos is a free, searchable index of {len(repos)} GitHub repositories starred by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">Akash Priyadarshi</a>: AI agents, MCP servers, Rust CLIs, RAG frameworks and developer tools, sorted into {len(cats)} categories. The page reads a baked snapshot of the public GitHub API, regenerated on demand, not a live feed. This build dates from {esc(date_mod)}.</p>
        <p>Every entry is here because it was useful for production work, architectural clarity, or agentic workloads. Nothing is sponsored and nothing is ranked by anyone but the star count, which is GitHub's.</p>

        <div class="faq">
          <details>
            <summary>What is my-starred-repos?</summary>
            <p>my-starred-repos is a free index of every GitHub repository starred by Akash Priyadarshi, searchable by keyword, category, and language, with a client-side Project Matcher that ranks tools against your own project description. New stars appear on the next sync run.</p>
          </details>
          <details>
            <summary>What are the best open-source AI agent and developer tool repositories in 2026?</summary>
            <p>Top-rated repositories include multi-agent orchestration frameworks (LangGraph, CrewAI, AutoGen, Hermes-Agent), Model Context Protocol servers (MCP), agent skill ecosystems (Claude Code skills, Superpowers, ECC), type-safe LLM tools (Pydantic-AI), token-efficient CLI utilities (rustygrep, zcat, repomap), and local agent assistants (OpenClaw, Browser-Use).</p>
          </details>
          <details>
            <summary>How does the Project Matcher rank repositories?</summary>
            <p>It scores every repository in the browser by keyword overlap across names, topics, languages, and descriptions, with a small boost for well-starred projects. Nothing you paste leaves the page, and scores are relative to the best match in the current dataset.</p>
          </details>
          <details>
            <summary>How often is the index updated?</summary>
            <p>There is no schedule. The owner re-runs the sync script against the public GitHub API and commits the result; the snapshot label in the header shows how old the current build is.</p>
          </details>
        </div>
      </div>

      <div class="stats-list" aria-label="Index statistics">
        <div><span>repositories</span><b>{len(repos):,}</b></div>
        <div><span>total stars</span><b>{fmt_num(total_stars)}</b></div>
        <div><span>average stars</span><b>{fmt_num(avg_stars)}</b></div>
        <div><span>categories</span><b>{len(cats)}</b></div>
        <div><span>top languages</span><b>{langs}</b></div>
        <div><span>snapshot</span><b>{esc(date_mod)}</b></div>
        <div><span>machine readable</span><b><a href="/llms.txt">llms.txt</a></b></div>
      </div>
    </section>
"""


EMOJI_RE = re.compile("[☀-➿⬀-⯿️‍🀀-🫿]")

def strip_emoji(text):
    return " ".join(EMOJI_RE.sub("", text or "").split())

def render_noscript(repos, n=30):
    """Plain-HTML top-N list for no-JS crawlers and lightweight AI fetchers."""
    items = "".join(
        f'<li><a href="{esc(r.get("url"))}">{esc(r.get("full_name"))}</a> — {esc(strip_emoji((r.get("description") or "No description provided.")[:140]))}</li>'
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
    title = f"Starred Repos · {esc(profile.get('name') or 'Akash Priyadarshi')} | {count} curated stars"

    # Meta description: ~140 chars (target 120-160)
    desc = (
        f"{count} curated GitHub starred repos by {esc(profile.get('name') or 'Akash Priyadarshi')}: "
        "AI agents, MCP, dev tools, systems, LLMs and web dev. Snapshot refreshed on demand."
    )

    about_html = render_about_section(repos, date_mod)
    cats = category_counts(repos)
    cat_total = sum(n for _, n in cats) or 1
    top_cat, top_n = cats[0] if cats else ("—", 0)
    top_pct = round(top_n / cat_total * 100)
    segs = "".join(
        f'<button class="ledger-seg" data-cat="{esc(c.lower())}" aria-pressed="false"'
        f' style="width:{n / cat_total * 100:.3f}%;--i:{i}"'
        f' title="{esc(c)} · {n:,} repos ({n / cat_total * 100:.0f}%)"></button>'
        for i, (c, n) in enumerate(cats)
    )
    keys = "".join(
        f'<button class="ledger-key" data-cat="{esc(c.lower())}" aria-pressed="false" style="--i:{i}">'
        f'<span class="swatch"></span>{esc(c)} <span class="n">{n:,}</span></button>'
        for i, (c, n) in enumerate(cats)
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Starred Repos",
        "url": "https://my-starred-repos.vercel.app/",
        "description": desc,
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Web",
        "softwareVersion": "0.4.0",
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
  <meta property="og:title" content="Starred Repos by {esc(profile.get('name') or 'Akash Priyadarshi')}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="https://my-starred-repos.vercel.app/icons/og-image.png">
  <meta property="og:image:alt" content="Starred Repos by {esc(profile.get('name') or 'Akash Priyadarshi')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Starred Repos">
  <meta property="og:locale" content="en_US">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://my-starred-repos.vercel.app/">
  <meta name="twitter:title" content="Starred Repos by {esc(profile.get('name') or 'Akash Priyadarshi')}">
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
  <meta name="theme-color" content="#171412">
  <meta name="msapplication-TileColor" content="#171412">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="style.css?v={CSS_V}">
  <script defer src="app.js?v={JS_V}"></script>
</head>
<body>

  <a href="#grid" class="skip-link">Skip to repository list</a>

  <header class="bar">
    <div class="bar-brand">
      <span class="mark" aria-hidden="true">AP</span>
      <span class="bar-name">Starred Repos</span>
      <span class="bar-scope">{count:,} repos · {len(cats)} categories · Akash Priyadarshi</span>
    </div>
    <nav class="bar-nav" aria-label="Other formats">
      <a href="/llms.txt">llms.txt</a>
      <a href="/api/search?q=agent">api</a>
      <a href="{esc(GITHUB)}" target="_blank" rel="noopener">github</a>
    </nav>
  </header>

  <div class="wrap">

    <section class="intro">
      <div>
        <h1 id="profile-name">{esc(profile.get('name') or 'Akash Priyadarshi')}</h1>
        <p class="intro-line">Every repository I have starred, {count:,} of them. {top_pct}% is AI and agent tooling, which says more about the last two years than about the list. Search it, filter it, or paste your project into the matcher.</p>
      </div>
      <span class="snapshot" id="sync-badge" title="Baked snapshot of the GitHub API">
        <span class="snapshot-dot"></span>
        <span id="sync-label">snapshot {esc(date_mod)}</span>
      </span>
    </section>

    <section class="ledger" aria-label="The library by category">
      <div class="ledger-head">
        <h2 class="label">The library, by category</h2>
        <p class="ledger-note"><b>{esc(top_cat)}</b> holds {top_n:,} of {cat_total:,} repos, {top_pct}% of the index</p>
      </div>
      <div class="ledger-bar" id="ledger-bar">{segs}</div>
      <div class="ledger-keys" id="ledger-keys">
        {keys}
        <button class="ledger-key pinned-key" data-cat="pinned" aria-pressed="false">Pinned <span class="n" id="pinned-count">0</span></button>
      </div>
    </section>

    <section class="toolbar" aria-label="Filters and sorting">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" id="search" placeholder="Search repos, topics  ( / )" autocomplete="off" aria-label="Search repositories">
        <button id="search-clear" class="search-clear hidden" aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <select id="lang-filter" aria-label="Filter by language">
        <option value="all">All languages</option>
      </select>
      <select id="sort" aria-label="Sort repositories">
        <option value="stars-desc">Stars, high to low</option>
        <option value="stars-asc">Stars, low to high</option>
        <option value="name-asc">Name, A to Z</option>
        <option value="updated-desc">Recently updated</option>
      </select>
      <button id="matcher-toggle-btn" class="btn" aria-expanded="false" aria-controls="matcher-panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path></svg>
        <span>Match a project</span>
      </button>
      <span class="result-count" id="result-count" aria-live="polite"></span>
    </section>

    <div id="matcher-panel" class="matcher hidden">
      <div class="matcher-head">
        <h2 class="matcher-title">Project matcher</h2>
        <button id="matcher-close-btn" class="matcher-close" aria-label="Close project matcher">&times;</button>
      </div>
      <p class="matcher-desc">Paste a README, a stack, or an idea. Every repo is scored in the browser by keyword overlap across names, topics, languages and descriptions, with a small boost for star count. Nothing leaves the page.</p>
      <textarea id="matcher-input" rows="3" placeholder="Offline-first Android expense tracker in Kotlin with local SQLite and SMS extraction"></textarea>
      <div class="matcher-actions">
        <button id="matcher-submit-btn" class="matcher-btn-primary">Rank repositories</button>
        <button id="matcher-reset-btn" class="matcher-btn-secondary">Clear</button>
        <span id="matcher-status" class="matcher-status"></span>
      </div>
      <div class="matcher-chips-wrap">
        <span class="matcher-chips-label">Try:</span>
        <button class="matcher-chip" data-prompt="Multi-agent orchestration Claude Code MCP servers tools">multi-agent and MCP</button>
        <button class="matcher-chip" data-prompt="Rust CLI high performance token efficient terminal utilities">Rust CLI</button>
        <button class="matcher-chip" data-prompt="Offline-first Android Kotlin Jetpack Compose SQLite">Android and Kotlin</button>
        <button class="matcher-chip" data-prompt="Web crawling headless browser scraping anti-bot">web scraping</button>
        <button class="matcher-chip" data-prompt="Local RAG embeddings vector database search">RAG and vector DBs</button>
      </div>
    </div>

    <div class="rows-head" aria-hidden="true">
      <span>#</span>
      <span>repository</span>
      <span>language</span>
      <span>stars</span>
      <span></span>
    </div>

    <main class="rows" id="grid" role="list" aria-label="Starred repositories">
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </main>

    {noscript_html}

    <div class="empty hidden" id="empty-state">
      <p>Nothing matches those filters.</p>
      <button id="empty-reset">Clear filters</button>
    </div>

    {about_html}

    <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

    <footer class="footer">
      <span>Starred Repos v0.4, a baked snapshot refreshed on demand. Built by <a href="{esc(GITHUB)}" target="_blank" rel="noopener">{esc(profile.get('name') or 'Akash Priyadarshi')}</a>.</span>
      <span><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/api/search?q=agent">api</a> · <a href="{esc(PORTFOLIO)}" target="_blank" rel="noopener">portfolio</a></span>
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
