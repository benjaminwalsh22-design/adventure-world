# 🌍 Adventure World

A bright, tactile PWA for explorers ages 8–10. Spin the globe, visit world
cities, play mini-games, and fill your Trophy Room with medals, stickers,
and bookmarks.

Built with Vite + React + TypeScript + Tailwind CSS + Three.js + Zustand.

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build
npm run smoke      # Playwright smoke test against the production build
                   #   (in the Cowork sandbox: CHROME_PATH=/opt/pw-browsers/chromium npm run smoke)
```

## Deploy

Deploys are fully automated — **pushing to `main` is the deploy button**.

1. `.github/workflows/deploy.yml` runs on every push to `main`:
   type-check → build (with `DEPLOY_BASE=/adventure-world/` for GitHub
   Pages project-site pathing) → Playwright smoke test of the critical
   kid-path (boot → globe → Rome → Matching Builder → match a pair) →
   publish `dist/` to GitHub Pages.
2. A failing smoke test **blocks the deploy** — the live site only ever
   receives verified builds.

One-time repo setup (already scripted, see below): create the GitHub repo,
push, and enable Pages with the "GitHub Actions" source
(`Settings → Pages → Source: GitHub Actions`, or
`POST /repos/{owner}/adventure-world/pages` with `{"build_type":"workflow"}`).

> If the repo is ever renamed, update `DEPLOY_BASE` in
> `.github/workflows/deploy.yml` to match `/<new-name>/`.

## Project layout

```
src/
  globe/        Three.js globe hub (GlobeScene engine + React wrapper)
  city/         City game hub modal + mini-game registry
  games/        Mini-games (lazy-loaded chunks), one folder each
  prize/        Trophy Room + sticker catalog
  components/   Reusable tactile UI (Button3D, Modal, ScoreHeader, …)
  state/        Zustand stores (settings/rewards/progress persisted;
                team/chat are v2 multiplayer stubs, COPPA-safe by design)
  lib/          Haptics + synthesized SFX
scripts/        smoke.mjs — the deploy gate
```
