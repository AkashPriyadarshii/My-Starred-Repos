# State Handoff

> Last updated: 2026-07-31 (India time)

## Current state (working)

- **Site live**: fresh data deployed to `https://my-starred-repos.vercel.app` — 781 starred repos, `repos_output.json` generated 2026-07-31
- **Repo**: `AkashPriyadarshii/My-Starred-Repos`, branch `main` at `6374b6a` (clean, pushed)
- **Data pipeline**: GH Action `sync-stars.yml` commits fresh JSON to git daily (cron `0 0 * * *`)

## Open issue — Vercel NOT git-connected

**Push ≠ live.** The Vercel project `my-starred-repos` is NOT connected to the GitHub repo:

- No webhooks on the repo (`gh api repos/AkashPriyadarshii/My-Starred-Repos/hooks` → empty)
- No `link` field in Vercel project record `prj_C4IA4vVZiKfsVpTsykwRVlzQpCLk`
- Old deployments carry no git metadata (manual/CLI deploys only)
- Proof: pushing `6374b6a` did not trigger a redeploy

**Consequence**: daily bot commit lands in git but never reaches the site. Site goes stale within a day unless manually redeployed.

**Fix (dashboard, user action)**: Vercel dashboard → `my-starred-repos` → Settings → Git → connect `AkashPriyadarshii/My-Starred-Repos`. After that, every push auto-redeploys.

**Manual deploy fallback** (works now):
```
cd C:\Users\saves\Desktop\My-Starred-Repos
vercel --prod
```
Vercel CLI already logged in as `akashpriyadarshii` (team `akash-projects-personal`). Token lives in OS credential manager, not on disk.

## Identity / signing (resolved)

- **Wrong**: previous config used `akashpriyadarshi@users.noreply.github.com` (different user, one `i` short) + an ed25519 key minted under that name → triggered GitHub vigilant mode
- **Fixed**: key deleted from laptop (`~/.ssh/id_ed25519*`, `allowed_signers`) and GitHub (signing key 1083677, auth key 158884552)
- **Git config now**: `user.name=Akash Priyadarshi`, `user.email=272530059+AkashPriyadarshii@users.noreply.github.com` (your account id 272530059)
- **Signing OFF** — no `commit.gpgsign`, no SSH URL rewrite; git uses HTTPS via gh credential manager
- **Note**: `user.name` still `Akash Priyadarshi` (one `i` short of your handle). Matches your profile display name — leave unless you want it changed

## Audit fixes shipped in `6374b6a`

| Fix | File |
|-----|------|
| README 404 `/dashboard/` link → `/` | README.md |
| dead `changelogRes`/Promise.allSettled → plain fetch | app.js |
| `repo.url` escaped in hrefs (defense-in-depth) | app.js |
| dead `onclick=stopPropagation` removed | app.js |
| `console.log` + unused `t0` removed | app.js |
| empty `GITHUB_USERNAME` guard | fetch_stars.py |
| stale JSON-LD `dateModified` refreshed | index.html |
| project doc added | CLAUDE.md |

## Local uncommitted (as of last check)

- `M .gitignore` — modification NOT from this session, left untouched
- `.omc/` — local tooling junk, never commit (not ignored — consider adding to .gitignore)

## Deployments on Vercel (team `akash-projects-personal`)

- `fgub8cdhd` — prod deploy, 2026-07-31 (CLI, current)
- `ii66nlmsj` — prod deploy, 2026-07-31 (CLI, current)
- older ones — manual uploads, stale JSON (July 11 / 658 repos era)

## Environment notes

- Windows 11, git via HTTPS (no SSH key on this laptop)
- Vercel CLI 54.9.0, token in OS keychain
- gh CLI authed as `AkashPriyadarshii`
- Python: `fetch_stars.py` runs clean locally (`python fetch_stars.py` with `GITHUB_TOKEN`)
