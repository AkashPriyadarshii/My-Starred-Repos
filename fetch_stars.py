#!/usr/bin/env python3
import os
import sys
import requests
import json
import re
import base64
import time
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter

# IST = UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

class GitHubAnalyzer:
    def __init__(self, token, username):
        self.token = token
        self.username = username
        self.headers = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        self.repos = []
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
        # Categorization keywords config
        self.keywords = {
            'AI & Agents': ['agent', 'openclaw', 'codex', 'claude', 'hermes', 'claw', 'opencode', 'grok', 'ai', 'copilot', 'assistant', 'gpt', 'llm', 'ollama', 'gemini', 'anthropic', 'openai', 'reasoning'],
            'LLM & RAG': ['mem', 'rag', 'memory', 'knowledge', 'vector', 'embedding', 'chromadb', 'pinecone', 'milvus', 'qdrant', 'langchain', 'llama-index', 'semantic'],
            'Web Automation': ['crawl', 'scrape', 'browser', 'selenium', 'playwright', 'puppeteer', 'firecrawl', 'scraping', 'crawler', 'headless'],
            'Web Development': ['react', 'vue', 'nextjs', 'svelte', 'nuxt', 'angular', 'django', 'flask', 'fastapi', 'express', 'node', 'tailwind', 'bootstrap', 'solidjs', 'astro'],
            'Databases & APIs': ['postgres', 'postgresql', 'mysql', 'sqlite', 'redis', 'mongodb', 'graphql', 'rest-api', 'trpc', 'supabase', 'prisma', 'drizzle', 'orm', 'nosql'],
            'Design & UI/UX': ['design', 'ui', 'component', 'style', 'css', 'figma', 'animation', 'canvas', 'framer', 'shadcn', 'lucide', 'icon'],
            'Systems & Dev Tools': ['editor', 'ide', 'git', 'code', 'cli', 'terminal', 'debug', 'linter', 'compiler', 'interpreter', 'rust', 'c-programming', 'cpp', 'gcc', 'llvm', 'assembler'],
            'DevOps & Infra': ['docker', 'devops', 'k8s', 'kubernetes', 'infra', 'deploy', 'podman', 'terraform', 'aws', 'gcp', 'azure', 'ci-cd', 'github-actions', 'vercel', 'nginx'],
            'Security & Pentesting': ['pentest', 'exploit', 'security', 'hack', 'cve', 'vuln', 'malware', 'attack', 'bypass', 'red-team', 'forensics', 'wireshark'],
            'Mobile Development': ['android', 'ios', 'mobile', 'react-native', 'flutter', 'kotlin', 'swift', 'swiftui', 'gradle'],
            'Media & Content': ['video', 'audio', 'image', 'media', 'streaming', 'content', 'ffmpeg', 'synthesis', 'speech-to-text', 'whisper']
        }

    def safe_get(self, url, timeout=10, retries=3):
        """HTTP GET wrapper with automatic primary and secondary rate limit handling"""
        backoff = 15
        for attempt in range(retries):
            try:
                resp = self.session.get(url, timeout=timeout)
                
                # Check primary rate limit headers
                remaining = resp.headers.get('X-RateLimit-Remaining')
                if remaining is not None and int(remaining) == 0:
                    reset_time = resp.headers.get('X-RateLimit-Reset')
                    if reset_time:
                        sleep_time = max(int(reset_time) - time.time() + 2, 5)
                        print(f"⚠️ Primary GitHub rate limit reached. Sleeping for {sleep_time:.1f}s until reset...")
                        time.sleep(sleep_time)
                        continue
                
                # Check for secondary rate limits / abuse detection
                if resp.status_code == 403 and any(x in resp.text.lower() for x in ["abuse", "rate limit", "retry"]):
                    retry_after = resp.headers.get('Retry-After')
                    sleep_time = int(retry_after) + 2 if retry_after else backoff
                    print(f"⚠️ Secondary rate limit (abuse block) detected. Sleeping for {sleep_time}s...")
                    time.sleep(sleep_time)
                    backoff *= 2
                    continue
                    
                return resp
            except Exception as e:
                print(f"⚠️ Network error on attempt {attempt+1}/{retries}: {e}")
                if attempt == retries - 1:
                    raise
                time.sleep(3)
        # Final retry attempt without catching
        return self.session.get(url, timeout=timeout)

    def fetch_all_starred(self):
        """Fetch all starred repos with pagination"""
        page = 1
        while True:
            url = f"https://api.github.com/users/{self.username}/starred?per_page=100&page={page}"
            try:
                resp = self.safe_get(url, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                
                if not data:
                     break
                
                self.repos.extend(data)
                print(f"✓ Page {page}: {len(data)} repos")
                
                if len(data) < 100:
                    break
                page += 1
            except Exception as e:
                print(f"✗ Error fetching page {page}: {e}")
                break
        
        print(f"\n✓ Total repos fetched: {len(self.repos)}\n")
    
    def fetch_readme(self, repo):
        """Fetch README from a repo with fallback"""
        owner, name = repo['full_name'].split('/')
        readme_names = [
            'README.md', 'README.txt', 'README.rst', 'readme.md', 
            'readme.txt', 'Readme.md', 'README', 'readme'
        ]
        
        for readme in readme_names:
            url = f"https://api.github.com/repos/{owner}/{name}/contents/{readme}"
            try:
                resp = self.safe_get(url, timeout=10)
                if resp.status_code == 200:
                    content = resp.json()
                    if 'content' in content:
                        readme_text = base64.b64decode(content['content']).decode('utf-8')
                        return readme_text, readme
            except:
                continue
        
        return None, None
    
    def extract_summary(self, readme_text):
        """Extract first 300 chars from README (fallback)"""
        if not readme_text:
            return None
        
        # Remove markdown syntax
        text = re.sub(r'[#*`\[\](){}]', '', readme_text)
        text = re.sub(r'\n+', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text[:300] if text else None

    def get_repo_category(self, name, description, language):
        """Classifies a repo into a category based on predefined keywords"""
        text = f"{name} {description or ''} {language or ''}".lower()
        for category, words in self.keywords.items():
            if any(word in text for word in words):
                return category
        return 'Other'

    def ai_summarize_readme(self, repo_name, readme_text):
        """Generates a professional 1-2 sentence summary of the repo using AI fallbacks"""
        if not readme_text or len(readme_text.strip()) < 50:
            return None
            
        readme_snippet = readme_text[:4000]
        prompt = (
            f"You are a technical documentation editor. Analyze this repository name: '{repo_name}' and its README content. "
            f"Write a concise, professional 1 or 2 sentence summary explaining exactly what the repository does and the primary tech stack used. "
            f"Do NOT use markdown headers, lists, or conversational filler. Output ONLY the raw summary text.\n\n"
            f"README snippet:\n{readme_snippet}"
        )
        
        # 1. Gemini Fallback Loop (tries 2.5, 1.5, and future models)
        gemini_key = os.environ.get('GEMINI_API_KEY', '').strip()
        if gemini_key:
            models_to_try = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3-flash", "gemini-3.5-flash", "gemini-3.1-flash"]
            for model in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"maxOutputTokens": 120, "temperature": 0.2}
                    }
                    resp = requests.post(url, json=payload, timeout=10)
                    if resp.status_code == 200:
                        data = resp.json()
                        summary = data['candidates'][0]['content']['parts'][0]['text'].strip()
                        if summary:
                            print(f"   ✨ Summarized {repo_name} using Gemini ({model})")
                            return summary
                except Exception as e:
                    print(f"   ⚠️ Gemini {model} failed for {repo_name}: {e}")
                
        # 2. Groq Fallback
        groq_key = os.environ.get('GROQ_API_KEY', '').strip()
        if groq_key:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 0.2
                }
                resp = requests.post(url, json=payload, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    summary = data['choices'][0]['message']['content'].strip()
                    if summary:
                        print(f"   ✨ Summarized {repo_name} using Groq")
                        return summary
            except Exception as e:
                print(f"   ⚠️ Groq failed for {repo_name}: {e}")

        # 3. Nvidia Fallback
        nvidia_key = os.environ.get('NVIDIA_API_KEY', '').strip()
        if nvidia_key:
            try:
                url = "https://integrate.api.nvidia.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {nvidia_key}", "Content-Type": "application/json"}
                payload = {
                    "model": "meta/llama-3.1-70b-instruct",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 0.2
                }
                resp = requests.post(url, json=payload, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    summary = data['choices'][0]['message']['content'].strip()
                    if summary:
                        print(f"   ✨ Summarized {repo_name} using Nvidia")
                        return summary
            except Exception as e:
                print(f"   ⚠️ Nvidia failed for {repo_name}: {e}")

        return None
    
    def process_repos(self):
        """Process each repo sequentially (rate limit friendly)"""
        results = []
        
        for i, repo in enumerate(self.repos, 1):
            try:
                readme_text, readme_name = self.fetch_readme(repo)
                
                # Fetch AI summary with local regex fallback
                summary = None
                if readme_text:
                    summary = self.ai_summarize_readme(repo['full_name'], readme_text)
                    if not summary:
                        summary = self.extract_summary(readme_text)
                
                # Generate category
                category = self.get_repo_category(repo['full_name'], repo.get('description'), repo.get('language'))
                
                result = {
                    'full_name': repo['full_name'],
                    'stars': repo.get('stargazers_count', 0),
                    'language': repo.get('language', 'Unknown'),
                    'description': repo.get('description', 'No description'),
                    'readme_summary': summary if summary else repo.get('description', 'No README'),
                    'readme_found': readme_text is not None,
                    'category': category,
                    'url': repo['html_url'],
                    'last_updated': repo.get('updated_at', 'Unknown'),
                    'license': repo.get('license', {}).get('spdx_id') if repo.get('license') else None,
                    'open_issues': repo.get('open_issues_count', 0),
                    'forks': repo.get('forks_count', 0),
                    'topics': repo.get('topics', [])
                }
                results.append(result)
                if i % 10 == 0 or i == len(self.repos):
                    print(f"✓ [{i}/{len(self.repos)}] {repo['full_name']}")
            except Exception as e:
                print(f"✗ Error processing {repo['full_name']}: {e}")
        
        sorted_results = sorted(results, key=lambda x: x['stars'], reverse=True)
        for idx, res in enumerate(sorted_results, 1):
            res['rank'] = idx
        return sorted_results
    
    def fetch_github_profile(self):
        """Fetch full GitHub profile for the user"""
        url = f"https://api.github.com/users/{self.username}"
        try:
            resp = self.safe_get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            profile = {
                'login':            data.get('login', self.username),
                'name':             data.get('name') or self.username,
                'bio':              data.get('bio') or '',
                'avatar_url':       data.get('avatar_url', ''),
                'html_url':         data.get('html_url', f'https://github.com/{self.username}'),
                'company':          data.get('company') or '',
                'blog':             data.get('blog') or '',
                'location':         data.get('location') or '',
                'twitter_username': data.get('twitter_username') or '',
                'public_repos':     data.get('public_repos', 0),
                'followers':        data.get('followers', 0),
                'following':        data.get('following', 0),
                'created_at':       data.get('created_at', ''),
                'fetched_at':       datetime.now(IST).isoformat()
            }
            print(f"✓ Profile fetched for {profile['login']} ({profile['followers']} followers)")
            return profile
        except Exception as e:
            print(f"✗ Failed to fetch profile: {e}")
            return {
                'login': self.username,
                'name': self.username,
                'avatar_url': '',
                'html_url': f'https://github.com/{self.username}',
                'fetched_at': datetime.now(IST).isoformat()
            }
            
    def save_output(self, results, profile=None):
        """Save results to JSON and generate changelog"""
        old_repos = {}
        try:
            with open('repos_output.json', 'r') as f:
                old_data = json.load(f)
                old_repos = {r['full_name']: r for r in old_data.get('repos', [])}
        except Exception as e:
            print(f"No previous repos_output.json found or failed to read: {e}")
            
        new_repos = {r['full_name']: r for r in results}
        added = [name for name in new_repos if name not in old_repos]
        removed = [name for name in old_repos if name not in new_repos]
        
        if added or removed:
            date_str = datetime.now(IST).strftime('%Y-%m-%d %H:%M IST')
            entry = f"## [{date_str}]\n\n"
            if added:
                entry += "### ➕ Added\n"
                for name in added:
                    r = new_repos[name]
                    entry += f"- **[{name}]({r['url']})** ({r['stars']:,}⭐) - {r['description']}\n"
                entry += "\n"
            if removed:
                entry += "### ➖ Removed\n"
                for name in removed:
                    entry += f"- {name}\n"
                entry += "\n"
            entry += f"**Total Repositories:** {len(results)} (+{len(added)} / -{len(removed)})\n\n---\n\n"
            
            changelog_content = ""
            try:
                with open('CHANGELOG.md', 'r') as f:
                    changelog_content = f.read()
            except:
                pass
                
            header = "# 📜 Starred Repos Changelog\n\nTrack history of starred and unstarred repositories.\n\n---\n\n"
            
            content_normalized = changelog_content.replace('\r\n', '\n')
            parts = content_normalized.split('\n---\n', 1)
            if len(parts) == 2 and "# 📜 Starred Repos Changelog" in parts[0]:
                body = parts[1].lstrip()
            else:
                body = content_normalized
                
            new_changelog = header + entry + body
            with open('CHANGELOG.md', 'w') as f:
                f.write(new_changelog)
            print("✅ CHANGELOG.md updated.")
            
        output = {
            'username': self.username,
            'total_repos': len(results),
            'generated_at': datetime.now(IST).isoformat(),
            'profile': profile or {'login': self.username, 'name': self.username},
            'repos': results
        }
        
        # Save JSON
        with open('repos_output.json', 'w') as f:
            json.dump(output, f, indent=2)
            
        return output

def generate_markdowns():
    """Reads repos_output.json and generates STARRED_ANALYSIS.md and ALL_STARRED_REPOS.md"""
    print("Generating markdown reports...")
    with open('repos_output.json', 'r') as f:
        data = json.load(f)
        
    repos = data['repos']
    
    # Categorize repos using pre-computed database fields
    categories = defaultdict(list)
    for repo in repos:
        categories[repo.get('category', 'Other')].append(repo)
            
    # Generate STARRED_ANALYSIS.md
    now_ist = datetime.now(IST)
    
    def get_top_language(repos_list):
        langs = [r['language'] for r in repos_list if r['language'] and r['language'] != 'Unknown']
        return Counter(langs).most_common(1)[0][0] if langs else 'Unknown'

    analysis_md = (
        "# 🌟 GitHub Starred Repos Analysis\n\n"
        f"**GitHub User:** `{data['username']}`  \n"
        f"**Total Repositories:** {data['total_repos']}\n"
        f"**Last Generated:** {now_ist.strftime('%Y-%m-%d %H:%M IST')}\n"
        "**Auto-Updated:** Daily @ 05:30 IST (00:00 UTC) via GitHub Actions\n\n"
        "---\n\n"
        "## 📊 Quick Stats\n\n"
        f"- **Total Starred:** {data['total_repos']}\n"
        f"- **Categories:** {len([v for v in categories.values() if v])}\n"
        f"- **Top Language:** {get_top_language(repos)}\n"
        f"- **Avg Stars:** {int(sum(r['stars'] for r in repos) / len(repos)) if repos else 0}\n\n"
        "## 🏆 Top 15 by Stars\n\n"
        "| Rank | Repo | Stars | Language |\n"
        "|------|------|-------|----------|\n"
    )
    
    for i, repo in enumerate(repos[:15], 1):
        analysis_md += f"| {i} | [{repo['full_name']}]({repo['url']}) | {repo['stars']:,} | {repo['language'] or 'N/A'} |\n"
        
    analysis_md += "\n---\n\n## 📂 By Category\n\n"
    
    for category, category_repos in sorted(categories.items(), key=lambda x: -len(x[1])):
        if not category_repos:
            continue
            
        analysis_md += f"### {category} ({len(category_repos)} repos)\n\n"
        
        # Show top 5 per category
        for repo in sorted(category_repos, key=lambda x: -x['stars'])[:5]:
            analysis_md += f"- **[{repo['full_name']}]({repo['url']})** ({repo['stars']:,}⭐) - {repo['description'] or 'No description'}\n"
            
        if len(category_repos) > 5:
            analysis_md += f"  *... and {len(category_repos) - 5} more*\n"
            
        analysis_md += "\n"
        
    analysis_md += (
        "---\n\n"
        "## 🔍 Language Distribution\n\n"
        "| Language | Count | % |\n"
        "|----------|-------|---|\n"
    )
    
    lang_count = defaultdict(int)
    for repo in repos:
        lang = repo['language'] or 'Unknown'
        lang_count[lang] += 1
        
    total = len(repos)
    for lang, count in sorted(lang_count.items(), key=lambda x: -x[1])[:10]:
        pct = round(100 * count / total, 1)
        analysis_md += f"| {lang} | {count} | {pct}% |\n"
        
    analysis_md += (
        "\n---\n\n"
        "## 📝 Notes\n\n"
        "- Auto-generated by GitHub Actions\n"
        "- Updated daily at 05:30 IST (00:00 UTC)\n"
        "- Source: GitHub API\n"
        f"- Last run: {now_ist.strftime('%Y-%m-%d %H:%M IST')}\n\n"
        "**Want to add/remove starred repos?** Star/unstar on GitHub, and this report auto-updates tomorrow!\n"
    )
    
    with open('STARRED_ANALYSIS.md', 'w') as f:
        f.write(analysis_md)
    print("✅ Markdown generated: STARRED_ANALYSIS.md")

    # Generate ALL_STARRED_REPOS.md
    all_repos_md = (
        "# 🌟 All Starred Repositories\n\n"
        f"**GitHub User:** `{data['username']}`  \n"
        f"**Total Repositories:** {data['total_repos']}\n"
        f"**Last Generated:** {now_ist.strftime('%Y-%m-%d %H:%M IST')}\n"
        "**Auto-Updated:** Daily @ 05:30 IST (00:00 UTC) via GitHub Actions\n\n"
        "---\n\n"
        "## 📋 Full Repository List (Sorted by Stars Descending)\n\n"
        "| Rank | Repo | Stars | Language | Description |\n"
        "|------|------|-------|----------|-------------|\n"
        "|------|------|-------|----------|-------------|\n"
    )

    for idx, repo in enumerate(repos, 1):
        desc = (repo['description'] or 'No description').replace('|', '\\|')
        all_repos_md += f"| {idx} | [{repo['full_name']}]({repo['url']}) | {repo['stars']:,} | {repo['language'] or 'N/A'} | {desc} |\n"

    all_repos_md += (
        "\n---\n\n"
        "## 📝 Notes\n"
        "- Auto-generated by GitHub Actions\n"
        f"- Updated daily at 05:30 IST (00:00 UTC) | Last run: {now_ist.strftime('%Y-%m-%d %H:%M IST')}\n"
    )

    with open('ALL_STARRED_REPOS.md', 'w') as f:
        f.write(all_repos_md)
    print("✅ Markdown generated: ALL_STARRED_REPOS.md")

if __name__ == "__main__":
    TOKEN = os.environ.get('GITHUB_TOKEN', '').strip()
    USERNAME = os.environ.get('GITHUB_USERNAME', 'AkashPriyadarshii').strip()
    
    if not TOKEN:
        print("Error: GITHUB_TOKEN environment variable not set")
        sys.exit(1)
        
    print("🚀 Starting GitHub Starred Repos Sync Process")
    print(f"Username: {USERNAME}")
    
    analyzer = GitHubAnalyzer(TOKEN, USERNAME)
    
    print("Phase 1: Fetching profile details...")
    profile = analyzer.fetch_github_profile()
    
    print("Phase 2: Paginating all starred repos...")
    analyzer.fetch_all_starred()
    
    print("Phase 3: Extrapolating README details...")
    results = analyzer.process_repos()
    
    print("Phase 4: Syncing changes to repos_output.json and CHANGELOG.md...")
    analyzer.save_output(results, profile)
    
    print("Phase 5: Generating Markdown index files...")
    generate_markdowns()
    
    print("\n✅ Starred Repos Sync Completed successfully!")
