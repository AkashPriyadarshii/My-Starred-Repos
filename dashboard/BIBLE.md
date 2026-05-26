# 🌟 BIBLE.md — Starred Repos Portfolio Dashboard

This document is the sole source of truth for the Starred Repos Portfolio Dashboard. All architectural decisions, design patterns, schemas, and specifications are compiled here.

---

## 📋 1. PRD (Product Requirements Document)
*   **Purpose:** Build a premium, high-performance static web dashboard that loads `repos_output.json` dynamically and displays starred repositories in a searchable, filterable, and beautifully styled card grid.
*   **Target User:** Single user (`Codekiller`), recruiting managers, and open-source contributors looking at the profile.
*   **Core Workflows:**
    1.  **Load & Initialize:** Fetch the parent directory's `repos_output.json` relatively. Cache the data structure in memory.
    2.  **Filter & Search:** Real-time search on titles, languages, and descriptions with visual highlight feedback and tag-based filtering (e.g., clicking on the "AI Agents" category tab).
    3.  **Explore Details:** Cards expand to show full details, including a clean display of the extracted README summary snippet.
    4.  **Changelog Integration:** Load the parent directory's `CHANGELOG.md` relatively, compile it in-browser, and render it in a dedicated "Changelog History" tab.
*   **Budget & Deployment:** ₹0 budget. Served statically via GitHub Pages from the repository root (or `/dashboard` folder).

---

## 👥 2. Roles
*   **System Owner / Admin:** `Codekiller` (Full root control, configurations exposed via a client-side Settings panel).
*   **End User:** Public visitor (Read-only access to search, filter, and explore stars).

---

## 🛠️ 3. Stack
| Layer | Technology | Why Best | Alternatives Considered | Cons | Neutralization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend UI** | HTML5 / CSS3 / Vanilla JS | Natively parsed by browser. Zero compile steps, zero bundle overhead. Best for high-refresh scrolling (120Hz). | React / Next.js (Rejected: requires compilation and node_modules). Tailwind CSS (Rejected: needs build process). | Lacks component abstraction. | Use ES6 template strings and class-based DOM reference caching. |
| **Icons Library** | Lucide Icons (via CDN) | Crisp, modern vector SVGs loaded dynamically. | FontAwesome (Rejected: heavy payload and slow rendering). | Requires internet connection. | Fallback text indicators on network failure. |
| **Markdown Parser** | Marked.js (via CDN) | Extremely fast client-side markdown compiling. Allows rendering CHANGELOG.md directly in the UI. | Showdown (Rejected: slightly larger bundle size, slower parsing). | Requires script load. | Defer script loading to prevent render-blocking. |
| **Data Engine** | Local Static JSON | Load times under 100ms. No database connection setup needed. | Supabase / MongoDB (Rejected: overkill for read-only static list). | Must keep files in sync. | Managed automatically by the daily GitHub Action. |
| **Hosting** | GitHub Pages | Free hosting, automatic deploys on git push. | Vercel / Netlify (Rejected: Pages keeps everything in one git ecosystem). | Cold start latency on first build. | Minimal builds, instant deployment. |

---

## 📐 4. HLD/LLD (High & Low Level Design)

### High-Level Architecture
```mermaid
graph TD
    A[Visitor Browser] -->|Load index.html| B[GitHub Pages Host]
    A -->|Fetch request| C[repos_output.json]
    A -->|Fetch request| F[CHANGELOG.md]
    A -->|Process Data & Render DOM| D[app.js]
    A -->|Style & Animations| E[style.css]
    A -->|Parse MD| G[Marked.js CDN]
    A -->|Load Icons| H[Lucide CDN]
```

### Low-Level Modules (Vanilla JS)
*   **`AppLogger`**: Custom JSON Logger class.
*   **`DataManager`**: Fetches the JSON file, loads the `CHANGELOG.md` file, sanitizes missing fields, and runs memory-cached query filtering.
*   **`UIManager`**: Pre-renders elements once. Manages card visibility toggles (`.hidden` state) on search inputs, compiles markdown using Marked.js, and initializes Lucide icons.
*   **`SettingsManager`**: Manages state for custom settings (card limits, default layout mode, theme overrides) using `localStorage`.

---

## 🗄️ 5. DB Schema (Static JSON Schema)
The system reads the structured output of `repos_output.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "OBJECT",
  "properties": {
    "username": { "type": "STRING" },
    "total_repos": { "type": "INTEGER" },
    "generated_at": { "type": "STRING", "format": "date-time" },
    "repos": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "rank": { "type": "INTEGER" },
          "full_name": { "type": "STRING" },
          "stars": { "type": "INTEGER" },
          "language": { "type": "STRING" },
          "description": { "type": "STRING" },
          "readme_summary": { "type": "STRING" },
          "readme_found": { "type": "BOOLEAN" },
          "url": { "type": "STRING", "format": "uri" },
          "last_updated": { "type": "STRING", "format": "date-time" }
        },
        "required": ["rank", "full_name", "stars", "url"]
      }
    }
  },
  "required": ["username", "total_repos", "generated_at", "repos"]
}
```

---

## 🔌 6. API Spec (Static Data Loading)
*   **Endpoint 1:** `GET ../repos_output.json` (Returns the structured repository array).
*   **Endpoint 2:** `GET ../CHANGELOG.md` (Returns the raw markdown log of repository changes).
*   **Client Routing:** Single Page Application (Hash-based router `#tab=changelog` or `#category=ai-agents` for shareable UI states).

---

## 🔒 7. Security
*   **No API Keys Exposes:** No tokens, passwords, or personal access tokens are stored in the frontend files.
*   **Content Security Policy (CSP):** Standard static site settings, allowing unpkg/jsDelivr CDNs for Lucide and Marked.
*   **Sanitization:** Text inputs are escaped using standard browser DOM functions (`element.textContent`) to prevent Cross-Site Scripting (XSS).

---

## 🎨 8. UI & Screens
*   **Theme:** Premium deep dark mode (`#070a13` background, `#0b0f19` panels, HSL gradient accents `#6366f1` to `#a855f7`).
*   **Layout:**
    *   **Header Section:** Profile identity, quick stats (total repos, categories, top language, average stars).
    *   **Navigation Tabs:** Toggle between "Repository Grid" and "Changelog History".
    *   **Control Panel:** Fuzzy search input, category selection tabs, sort drop-down, and card layout density toggles (visible only under Repository Grid).
    *   **Card Grid:** Responsive cards featuring rank tags, glowing borders, language indicator chips, and an expandable README summary fold.
    *   **Changelog Panel:** Rendered markdown list of updates using Marked.js.
    *   **Settings Panel:** Slider for max visible cards, dark/pitch-black theme toggles, and circular buffer log inspector.

---

## 🎯 9. Features
*   **Fuzzy Search:** Filter cards instantly as you type (150ms debounced).
*   **Fast Category Filters:** One-click filter tabs to filter by AI Agents, Web Automation, DevOps, and Dev Tools.
*   **Sorting Modes:** Sort by Star Count (descending/ascending), Rank, and Name.
*   **Interactive Changelog:** Load, compile, and display the repository update history directly on the screen.
*   **Local Settings Control:** Full settings panel to customize card density, theme, and logs.

---

## 🏃 10. Sprints (Implementation Plan)
*   **Sprint 1: Foundation & Logging**
    *   Setup HTML structure, load Lucide & Marked CDNs, configure CSS styling variables, and build the `AppLogger` system.
*   **Sprint 2: Data Fetching & Rendering**
    *   Implement async fetch modules for both JSON and Markdown, parse repository objects, and perform initial card grid generation.
*   **Sprint 3: Filtering, Search, & Changelog Engine**
    *   Implement debounced fuzzy search, category tabs, sorting drop-downs, and render `CHANGELOG.md` inside the Updates tab.
*   **Sprint 4: Settings & Final Polish**
    *   Create settings control panel, download logs action, glassmorphism animations, and verify layouts on mobile and desktop.

---

## 🚀 11. Deploy
1. The code is written inside the `/dashboard` directory.
2. An `index.html` file is added at the repository root redirecting requests automatically to `dashboard/index.html`.
3. Changes are pushed to the remote repository.
4. GitHub Pages is configured to serve from the `main` branch. The page is instantly accessible at: `https://AkashPriyadarshii.github.io/My-Starred-Repos/dashboard/`.

---

## 🧪 12. Testing
*   **Fuzzy Search Validation:** Test filtering with terms containing special characters. Assert performance.
*   **Responsive Layout Checks:** Verify layouts rendering correctly at 360px (mobile) up to 2560px (ultra-wide monitors).
*   **Performance Metrics:** Run Lighthouse audit. Aim for 100/100 performance score (sub-100ms Largest Contentful Paint).

---

## 📈 13. Monitoring & Logger System
*   **`AppLogger`** keeps logs in a local circular buffer of 500 entries.
*   Log formats conform to:
    ```json
    {
      "timestamp": "2026-05-25T17:19:28.000Z",
      "level": "INFO",
      "module": "NETWORK",
      "event": "FetchDataCompleted",
      "payload": { "total_repos": 317 },
      "duration_ms": 42
    }
    ```
*   Logs can be exported directly as a JSON file or viewed via the settings control panel.

---

## ⚠️ 14. Constraints & Risks
*   **No Build System:** Pure standard native JS. Avoid packages from npm or node modules.
*   **CDN Availability:** Relies on Lucide and Marked CDN links. Neutralizer: Load local fallbacks or display text descriptions if CDNs fail to load.
*   **₹0 Cost Constraint:** Strict dependency on free static hosting (GitHub Pages).

---

## 🧠 15. Decision Log
*   *Decision:* Pre-render cards on page load and toggle `.hidden` state.
    *   *Alternative:* Recreate elements dynamically on every search query.
    *   *Reason:* Toggling visibility is significantly faster and eliminates stutters.
*   *Decision:* Use Marked.js client-side.
    *   *Alternative:* Duplicate changelog data inside JSON file.
    *   *Reason:* Reading the markdown file directly keeps the code cleaner and leverages the existing CHANGELOG.md file.

---

## 🔧 16. Onboarding & Environment
*   **Local Setup:** Run any simple HTTP server in the repository root directory (e.g., `python -m http.server 8000` or double-click `index.html` via file protocol since resources are relative).
*   **Environment Variables:** None (all values computed dynamically in runtime).

---

## 📜 ##PROMPTS

### Sprint 1 Prompt (Foundation & UI Architecture)
```text
Build the foundation folder and UI file structure for the dynamic Starred Repos Dashboard. Create a directory named dashboard/ containing index.html, style.css, and app.js. Index.html must load Lucide Icons (via CDN https://unpkg.com/lucide@latest) and Marked.js (via CDN https://cdn.jsdelivr.net/npm/marked/marked.min.js). Implement the full theme system using HSL CSS variables, custom typography, dark background styling, and the AppLogger singleton in app.js for logging initialization phases. Ensure index.html includes structural containers for the Header, Navigation Tabs, Control Panel, Grid, Changelog Panel, and Settings panel. Do not include search logic or actual card components yet.
```

### Sprint 2 Prompt (Data Loading & Rendering)
```text
Implement the asynchronous data loading logic in app.js. Fetch the parent directory's repos_output.json and CHANGELOG.md relatively. Bind data processing errors to AppLogger and display error overlays if the files fail to load. Render the parsed list of 317 repositories into the HTML card container, mapping ranks, star counts, descriptions, languages, and README summaries into custom template structures with micro-animations, Lucide icons, and border glows.
```

### Sprint 3 Prompt (Search, Filtering, & Changelog Engine)
```text
Implement the search, filtering, and Markdown rendering logic. Add input listener to search bar with 150ms debouncing, toggling the class ".hidden" on cards based on search terms. Connect the category tabs to filter by tag prefixes and sorting drop-downs to re-order cards dynamically on the screen. Inside the Changelog panel, parse CHANGELOG.md dynamically using the marked.parse() function and render the HTML directly into the updates container. Implement the hash-based router to toggle between the Repository Grid and Changelog views.
```

### Sprint 4 Prompt (Settings Control & Polish)
```text
Implement the settings inspector in the dashboard interface. Create controls for layout density selection, maximum visible cards sliders, dark/pitch-black theme overrides, and a log reader displaying the AppLogger circular buffer with a log download button. Polish glassmorphism backdrop blurs, transition durations, and verify mobile responsiveness and touch gestures.
```

---

## 📁 ##CLAUDE.md

```markdown
# Starred Repos Dashboard

## Identity & Mission
You are an expert frontend engineering agent building a premium, high-performance portfolio dashboard for the developer's starred repositories.

## Tech Stack
*   HTML5 (Semantic elements only)
*   CSS3 (Vanilla custom properties, Grid, Flexbox, backdrop-filter)
*   JavaScript (ES6+, Vanilla DOM, asynchronous Fetch API)
*   Approved CDNs: Lucide Icons, Marked.js

## Key Files
*   `dashboard/index.html` - Base application interface
*   `dashboard/style.css` - Custom styling theme engine
*   `dashboard/app.js` - Data handling, fuzzy search, and logger execution

## Constraints
*   **保持零成本 (₹0 Budget):** Must run completely free on GitHub Pages.
*   **Zero Local Build Dependencies:** Do not import any local NPM packages, Tailwind CLI, compilers, or build scripts. Load approved libraries via CDN.
*   **One User Mode:** Single-user design, optimized for high performance on 120Hz mobile (Realme GT 7) and desktop (MacBook Air).

## Code Style & Rules
*   Never write placeholders or partial code blocks. All code must be complete.
*   Use native custom elements or ES6 template strings for rendering.
*   Always log network actions, sorting changes, search interactions, and error boundaries through the `AppLogger` singleton.

---

## 🔒 17. Sprint 5: Telemetry, OAuth, & Netlify Functions (Architecture)

### Telemetry Storage Schema (IndexedDB)
The local visitor statistics are stored in IndexedDB under the database name `analytics_db` (Version 1).
- **Object Store:** `visits`
  - **KeyPath:** `id` (auto-incrementing integer)
  - **Indexes:**
    - `timestamp`: ISO-8601 string of visit creation time.
    - `repo_clicked`: Full repository name (e.g. `owner/repo-name`) or `null` if page-view only.
  - **Record Structure:**
    ```json
    {
      "id": 12,
      "timestamp": "2026-05-26T04:00:00.000Z",
      "repo_clicked": "AkashPriyadarshii/My-Starred-Repos",
      "theme": "tokyo-midnight",
      "device": "desktop",
      "referrer": "github.com",
      "session_id": "b7d87680-e768-45fa-bb19-01ea897a151b",
      "duration_ms": 14200
    }
    ```

### OAuth Authorization & Token Exchange Flow (Netlify Serverless)
Due to CORS security limitations on client-side token exchanges, a serverless intermediary handles the authentication transaction:
1. **Redirect:** The visitor clicks "Sign in with GitHub" on the admin portal redirecting to:
   `https://github.com/login/oauth/authorize?client_id=<CLIENT_ID>&scope=read:user&state=<RANDOM_CSRF_STATE>`
2. **Callback Handling:** The user is redirected back to `/admin/callback.html` with temporary `code` and `state`. The state is matched against the local session token to prevent CSRF attacks.
3. **Netlify Functions Exchange:** The client posts `code` to the Netlify serverless endpoint:
   `POST https://<site>.netlify.app/.netlify/functions/oauth`
   The serverless function reads the `client_id` and `client_secret` from its secure environment variables and calls:
   `POST https://github.com/login/oauth/access_token`
4. **Access Control Check:** The returned `access_token` is used to request the user profile `https://api.github.com/user`. If the login name matches `@AkashPriyadarshii` exactly (case-insensitive), access is granted, the token is stored in `sessionStorage` (which auto-clears when closing the tab), and the user is redirected to the Chart.js Admin dashboard.
```
