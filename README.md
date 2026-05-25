# 🌟 Starred Repos Tracker & Analyzer

An automated tracker that fetches, organizes, and analyzes my starred GitHub repositories every day.

## 📊 Quick Links
* **[Pretty Markdown Analysis](STARRED_ANALYSIS.md)**: Daily updated analysis categorized by tech stack and category.
* **[Full Repository List](ALL_STARRED_REPOS.md)**: Daily updated flat list of all repositories sorted by star count.
* **[Changelog History](CHANGELOG.md)**: Daily log of added and removed starred repositories.
* **[Raw JSON Data](repos_output.json)**: Raw JSON structured output for programmatic use and dashboards.

---

## 🛠️ How It Works
1. **GitHub Action** triggers automatically every 24 hours (at midnight UTC).
2. It fetches all starred repositories for `AkashPriyadarshii` via the GitHub API.
3. It parses each repository's metadata and extracts README summaries.
4. It categorizes the repositories (e.g., AI Agents, Web Automation, Dev Tools, Mobile) and calculates stats.
5. It commits and pushes the updated **[STARRED_ANALYSIS.md](STARRED_ANALYSIS.md)** and **[repos_output.json](repos_output.json)** back to this repository.

---

## 🔒 Security & Privacy (Is this safe?)
**Yes, it is 100% safe.** 

* **No Personal Secrets:** The workflow does **NOT** use your personal password or personal access tokens (PAT). It uses GitHub's built-in `GITHUB_TOKEN` which is temporary and expires as soon as the run is done.
* **Public Data Only:** The script fetches public starred repositories, which are already public on GitHub. No private information is accessed or leaked.
* **Auto-Rotated Key:** The token used is scoped only to this repository, meaning it cannot be used to modify or access anything else on your account.
