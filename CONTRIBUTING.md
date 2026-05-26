# Contributing

Contributions welcome.

## Reporting Issues
- Use [GitHub Issues](https://github.com/AkashPriyadarshii/My-Starred-Repos/issues)
- Include browser + OS for UI bugs
- Include steps to reproduce

## Pull Requests
1. Fork the repo
2. Branch: `git checkout -b fix/your-fix-name`
3. Read constraints below before coding
4. Open PR with clear description

## Constraints
- Zero build steps. No npm, no bundlers. Pure HTML/CSS/JS only.
- Zero new CDN dependencies without issue discussion first.
- Approved CDNs: Lucide (unpkg), Marked.js (jsDelivr), Chart.js v4 (jsDelivr)
- No frameworks. No React, Vue, Svelte, Tailwind. Vanilla only.
- ES6+, strict mode, all async in try/catch, all errors via AppLogger singleton.
- Single user scope — no multi-user, no backend features.

## What's Welcome
- Bug fixes
- Performance improvements
- Accessibility improvements
- New themes (follow CSS variable pattern in style.css)
- Better mobile UX

## What's Not Welcome
- Breaking existing localStorage settings keys
- Removing features without issue discussion
- Backend dependencies

## License
Contributions licensed under [MIT License](./LICENSE).
