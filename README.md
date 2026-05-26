# 🌟 Akash Priyadarshi (@AkashPriyadarshii) — Starred Repos Tracker & Analyzer

**GitHub Starred Repos Dashboard** | **Auto-Updating Starred Repos** | **Glassmorphism Dashboard GitHub**

An automated tracker that fetches, organizes, and analyzes my starred GitHub repositories every day.

---

## 📊 Quick Links
* **[Interactive Portfolio Dashboard](https://akashpriyadarshii.github.io/My-Starred-Repos/dashboard/index.html)**: Live interactive web app portfolio featuring premium UI/UX, particle canvas background, glassmorphism design, 6 themes, and daily GitHub Actions sync
* **[Pretty Markdown Analysis](STARRED_ANALYSIS.md)**: Daily updated analysis categorized by tech stack and category.
* **[Full Repository List](ALL_STARRED_REPOS.md)**: Daily updated flat list of all repositories sorted by star count.
* **[Changelog History](CHANGELOG.md)**: Daily log of added and removed starred repositories.
* **[Raw JSON Data](repos_output.json)**: Raw JSON structured output for programmatic use and dashboards.

---

## 🌐 Interactive Portfolio Dashboard
An interactive Single Page Application (SPA) dashboard styled with modern glassmorphism.

* **🌌 Constellation Particles**: Active particle canvas background nodes following the cursor.
* **🛸 3D Card Hover**: 3D perspective tilt and glowing holographic spotlight borders.
* **🎨 6 Themes**: Tokyo Midnight, Cyber Punk, Nordic Frost, Forest Tech, Aura Light, AMOLED Pure.
* **⚙️ Performance Controls**: Switch between High Performance and Low-End / Battery Saver presets (caps visible cards at 50 to optimize battery/render times).
* **🧸 Experience Modes**: Developer (includes diagnostics console) vs. Simple (Non-Tech) Mode.
* **📲 Offline PWA**: Installable locally with offline caching.

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

* **No Personal Secrets:** The workflow does **NOT** use your personal password or personal access tokens (PAT). It uses GitHub's built-in `GITHUB_TOKEN` which is temporary and expires as soon as the workflow finishes.
* **Public Data Only:** The script fetches public starred repositories, which are already public on GitHub. No private information is accessed or leaked.
* **Auto-Rotated Key:** The token used is scoped only to this repository, meaning it cannot be used to modify or access anything else on your account.

---

## Admin Analytics Setup

### 1. Create GitHub OAuth App
- GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
- Name: `My-Starred-Repos Analytics`
- Homepage: `https://akashpriyadarshii.github.io/My-Starred-Repos/`
- Callback URL: `https://akashpriyadarshii.github.io/My-Starred-Repos/admin/callback.html`
- Copy Client ID → paste into `admin/config.js` as `OAUTH_CLIENT_ID`
- Copy Client Secret → save for Netlify env var (never put in code)

### 2. Deploy Netlify Function (OAuth token exchange)
- Go to netlify.com → New site → Import from GitHub → select this repo
- Site settings → Environment variables → add:
  - `GITHUB_OAUTH_CLIENT_ID` = your OAuth App Client ID
  - `GITHUB_OAUTH_CLIENT_SECRET` = your OAuth App Client Secret
- Copy your Netlify site URL → update `NETLIFY_OAUTH_FN` in `admin/config.js`

### 3. Access Admin
- Visit: `https://akashpriyadarshii.github.io/My-Starred-Repos/admin/`
- Login with GitHub (@AkashPriyadarshii only)

## Legal
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

- [Privacy Policy](./PRIVACY.md)
- [Contributing](./CONTRIBUTING.md)
