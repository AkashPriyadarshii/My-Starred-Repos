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

def safe_get(session, url, timeout=10, retries=3):
    backoff = 15
    for attempt in range(retries):
        try:
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

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch public starred repos from GitHub")
    parser.add_argument('--full', action='store_true', help="Fetch all pages even if repos_output.json exists")
    parser.add_argument('--user', default='AkashPriyadarshii', help="GitHub username")
    args = parser.parse_args()

    token = os.environ.get('GITHUB_TOKEN', '').strip()
    username = args.user or os.environ.get('GITHUB_USERNAME', '').strip() or 'AkashPriyadarshii'

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

    # Check existing data for incremental sync
    existing_repos = []
    existing_map = {}
    if os.path.exists('repos_output.json') and not args.full:
        try:
            with open('repos_output.json', 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                existing_repos = old_data.get('repos', [])
                existing_map = {r['full_name']: r for r in existing_repos}
            print(f"Found {len(existing_repos)} existing repos in repos_output.json")
        except Exception:
            existing_map = {}

    # Fetch starred repos
    print("Fetching starred repos...")
    new_repos_raw = []
    page = 1
    found_existing = False

    while True:
        resp = safe_get(session, f"https://api.github.com/users/{username}/starred?per_page=100&page={page}", timeout=30)
        rem = resp.headers.get('X-RateLimit-Remaining', '?')
        lim = resp.headers.get('X-RateLimit-Limit', '?')
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break

        print(f"  Page {page}: {len(data)} repos (rate limit remaining: {rem}/{lim})")

        # In incremental mode, check if we've seen these repos before
        if existing_map and not args.full:
            batch_new = []
            for r in data:
                if r['full_name'] in existing_map:
                    found_existing = True
                    break
                batch_new.append(r)
            new_repos_raw.extend(batch_new)
            if found_existing:
                print("  Reached previously synced repos. Stopping early (saved API calls).")
                break
        else:
            new_repos_raw.extend(data)

        if len(data) < 100:
            break
        page += 1

    if existing_map and not args.full and found_existing:
        print(f"Incremental sync: found {len(new_repos_raw)} newly starred repos")
        processed_new = []
        for r in new_repos_raw:
            processed_new.append({
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
            })
        combined = processed_new + [r for r in existing_repos if r['full_name'] not in {n['full_name'] for n in processed_new}]
        combined.sort(key=lambda x: x.get('stars', 0), reverse=True)
        for idx, res in enumerate(combined, 1):
            res['rank'] = idx
        results = combined
    else:
        # Full sync processing
        print(f"Total fetched: {len(new_repos_raw)} repos\n")
        results = []
        for i, r in enumerate(new_repos_raw, 1):
            results.append({
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
            })
        results.sort(key=lambda x: x['stars'], reverse=True)
        for idx, res in enumerate(results, 1):
            res['rank'] = idx

    output = {
        'username': username,
        'total_repos': len(results),
        'generated_at': datetime.now(IST).isoformat(),
        'profile': profile,
        'repos': results,
    }

    with open('repos_output.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. Wrote repos_output.json ({len(results)} total repos)")

if __name__ == "__main__":
    main()
