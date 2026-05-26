# 🌟 My Starred Repositories

An automated portfolio dashboard showcasing my curated collection of GitHub starred repositories, categorized and summarized using an AI fallback pipeline.

## 🔗 Quick Links
* **[Interactive Dashboard](https://akashpriyadarshii.github.io/My-Starred-Repos/dashboard/)**: Live glassmorphism web app featuring 6 premium themes, search, filter, and comparison grids.
* **[Markdown Analysis](STARRED_ANALYSIS.md)**: Daily updated repository counts grouped by category and language.
* **[Full Repository List](ALL_STARRED_REPOS.md)**: Complete database index of stars sorted by count.
* **[Changelog History](CHANGELOG.md)**: Sequential history tracking starred additions and removals.

## 🛠️ Architecture & Tech Stack
* **Frontend:** Vanilla HTML5, CSS3 (CSS Variables, grid/flexbox layouts), and ES6+ JavaScript. Offline support is configured using a PWA Service Worker.
* **Sync Engine (`fetch_stars.py`):** Scheduled GitHub Actions workflow executing a python compiler to update metadata, query README summaries using a Gemini 2.5 → 1.5 → Groq → Nvidia API fallback loop, and build static JSON caches.
* **Telemetry & Analytics:** Private telemetry dashboard using Supabase backend with a Vercel serverless gateway for GDPR-compliant daily-salted IP anonymization.

## 📜 License
Copyright (c) 2026 Akash Priyadarshi (@AkashPriyadarshii). All rights reserved.

This repository is governed under a custom **Proprietary License** prohibiting unauthorized hosting, redistribution, modification, or derivative deployments of the dashboard interfaces and API telemetry routing.
