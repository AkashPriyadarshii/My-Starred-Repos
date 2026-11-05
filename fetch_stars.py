#!/usr/bin/env python3
import os, re, sys, requests, json, time
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

CATEGORIES = {
    'AI & Agents': ['agent', 'openclaw', 'codex', 'claude', 'hermes', 'opencode', 'grok', 'ai', 'copilot', 'gpt', 'llm', 'ollama', 'gemini', 'anthropic', 'openai', 'reasoning'],
    'LLM & RAG': ['rag', 'memory', 'knowledge', 'vector', 'embedding', 'chromadb', 'pinecone', 'milvus', 'qdrant', 'langchain', 'llama-index', 'semantic'],
    'Web Automation': ['crawl', 'scrape', 'browser', 'selenium', 'playwright', 'puppeteer', 'firecrawl', 'headless'],
    'Web Dev': ['react', 'vue', 'nextjs', 'svelte', 'nuxt', 'angular', 'django', 'flask', 'fastapi', 'express', 'node', 'tailwind', 'solidjs', 'astro'],
    'Databases': ['postgres', 'mysql', 'sqlite', 'redis', 'mongodb', 'graphql', 'supabase', 'prisma', 'drizzle', 'orm'],
    'Dev Tools': ['editor', 'ide', 'git', 'cli', 'terminal', 'debug', 'linter', 'compiler', 'rust', 'c-programming', 'cpp', 'llvm'],
    'DevOps': ['docker', 'devops', 'k8s', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure', 'ci-cd', 'github-actions', 'vercel', 'nginx'],
    'Security': ['pentest', 'exploit', 'security', 'hack', 'cve', 'vuln', 'malware', 'red-team', 'forensics'],
    'Mobile': ['android', 'ios', 'mobile', 'react-native', 'flutter', 'kotlin', 'swift', 'swiftui', 'gradle'],
    'Media': ['video', 'audio', 'image', 'media', 'ffmpeg', 'speech-to-text', 'whisper'],
}

REQUEST_COUNT = 0


def safe_get(session, url, timeout=10, retries=3):
    global REQUEST_COUNT
    backoff = 15
    for attempt in range(retries):
        try:
            REQUEST_COUNT += 1
            resp = session.get(url, timeout=timeout)
            remaining = resp.headers.get('X-RateLimit-Remaining')
            if remaining is not None and int(remaining) == 0:
                reset_time = resp.headers.get('X-RateLimit-Reset')
                if reset_time:
                    sleep_time = max(int(reset_time) - time.time() + 2, 5)
                    print(f"Rate limit hit. Sleeping {sleep_time:.0f}s...")
                    time.sleep(sleep_time)
                    continue
            if resp.status_code == 403 and 'rate limit' in resp.text.lower():
                retry_after = resp.headers.get('Retry-After')
                sleep_time = int(retry_after) + 2 if retry_after else backoff
                time.sleep(sleep_time)
                backoff *= 2
                continue
            return resp
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(3)
    return session.get(url, timeout=timeout)

# Short keywords ("ai", "git", "cli"...) need word boundaries — bare "ai"
# must not match "gmail"/"main"/"container". Longer keywords keep substring
# matching so compounds still work ("ioredis" -> redis, "playwright-ai" -> playwright).
_CAT_RE = {
    cat: [re.compile(rf"\b{re.escape(w)}\b" if len(w) < 4 else re.escape(w)) for w in words]
    for cat, words in CATEGORIES.items()
}

def categorize(name, desc, lang):
    text = f"{name} {desc or ''} {lang or ''}".lower()
    for cat, pats in _CAT_RE.items():
        if any(p.search(text) for p in pats):
            return cat
    return 'Other'

def to_repo(r, synced_at):
    return {
        'full_name': r['full_name'],
        'stars': r.get('stargazers_count', 0),
        'language': r.get('language') or 'Unknown',
        'description': r.get('description') or 'No description',
        'category': categorize(r['full_name'], r.get('description'), r.get('language')),
        'url': r['html_url'],
        'last_updated': r.get('updated_at', ''),
        'pushed_at': r.get('pushed_at', ''),
        'archived': r.get('archived', False),
        'license': r.get('license', {}).get('spdx_id') if r.get('license') else None,
        'forks': r.get('forks_count', 0),
        'topics': r.get('topics', []),
        'synced_at': synced_at,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch public starred repos from GitHub (no token required)")
    parser.add_argument(
        '--incremental',
        action='store_true',
        help="Stop at the first already-known repo. Saves requests, but known repos keep their old "
             "star counts and unstarred repos are never pruned. Use --full to repair drift.",
    )
    parser.add_argument('--user', default='AkashPriyadarshii', help="GitHub username")
    args = parser.parse_args()

    token = os.environ.get('GITHUB_TOKEN', '').strip()
    username = args.user or os.environ.get('GITHUB_USERNAME', '').strip() or 'AkashPriyadarshii'

    global REQUEST_COUNT
    REQUEST_COUNT = 0

    session = requests.Session()
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': f'my-starred-repos-public/0.3 ({username})'
    }
    if token:
        headers['Authorization'] = f'token {token}'
        print("Using provided GITHUB_TOKEN")
    else:
        print("Running in 100% public unauthenticated mode (no tokens)")

    session.headers.update(headers)

    # Fetch profile
    print("Fetching profile...")
    try:
        resp = safe_get(session, f"https://api.github.com/users/{username}", timeout=15)
        rem = resp.headers.get('X-RateLimit-Remaining', '?')
        lim = resp.headers.get('X-RateLimit-Limit', '?')
        print(f"  [Rate limit: {rem}/{lim} remaining]")
        resp.raise_for_status()
        d = resp.json()
        profile = {
            'login': d.get('login', username),
            'name': d.get('name') or username,
            'bio': d.get('bio') or '',
            'avatar_url': d.get('avatar_url', ''),
            'html_url': d.get('html_url', f'https://github.com/{username}'),
            'followers': d.get('followers', 0),
            'following': d.get('following', 0),
            'public_repos': d.get('public_repos', 0),
        }
        print(f"  {profile['login']} - {profile['followers']} followers")
    except Exception as e:
        print(f"  Profile fetch failed: {e}")
        profile = {'login': username, 'name': username}

    existing_repos = []
    existing_map = {}
    if args.incremental and os.path.exists('repos_output.json'):
        try:
            with open('repos_output.json', 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            existing_repos = old_data.get('repos', [])
            existing_map = {r['full_name']: r for r in existing_repos}
            print(f"Incremental mode: {len(existing_repos)} repos already in repos_output.json")
        except Exception:
            existing_map = {}

    print("Fetching starred repos...")
    raw_repos = []
    page = 1
    stopped_early = False

    while True:
        resp = safe_get(session, f"https://api.github.com/users/{username}/starred?per_page=100&page={page}", timeout=30)
        rem = resp.headers.get('X-RateLimit-Remaining', '?')
        lim = resp.headers.get('X-RateLimit-Limit', '?')
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break

        print(f"  Page {page}: {len(data)} repos (rate limit remaining: {rem}/{lim})")

        if existing_map:
            fresh = []
            for r in data:
                if r['full_name'] in existing_map:
                    stopped_early = True
                    break
                fresh.append(r)
            raw_repos.extend(fresh)
            if stopped_early:
                print("  Reached previously synced repos. Stopping early.")
                break
        else:
            raw_repos.extend(data)

        if len(data) < 100:
            break
        page += 1

    now = datetime.now(IST).isoformat()
    fetched = [to_repo(r, now) for r in raw_repos]

    if existing_map and stopped_early:
        fetched_names = {r['full_name'] for r in fetched}
        # Known repos keep their original synced_at so stale metadata stays visible.
        results = fetched + [r for r in existing_repos if r['full_name'] not in fetched_names]
        print(f"Incremental: {len(fetched)} new, {len(results) - len(fetched)} kept from previous snapshot")
        print("  Known repos were not re-fetched; run without --incremental to refresh stars and prune unstars.")
    else:
        results = fetched
        print(f"Full sync: {len(results)} repos fetched")

    results.sort(key=lambda x: x.get('stars', 0), reverse=True)

    output = {
        'schema_version': 1,
        'username': username,
        'total_repos': len(results),
        'generated_at': now,
        'sync_mode': 'incremental' if (existing_map and stopped_early) else 'full',
        'requests_used': REQUEST_COUNT,
        'profile': profile,
        'repos': results,
    }

    with open('repos_output.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. Wrote repos_output.json ({len(results)} repos, {REQUEST_COUNT} requests)")
    print("Next: python build_site.py")


if __name__ == "__main__":
    main()
