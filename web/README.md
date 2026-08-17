# web/ — AgentLens landing page

A single self-contained `index.html`. No build step, no dependencies, no framework.

It is intentionally decoupled from the CLI: nothing in `src/` imports it, and nothing here
is part of `npm run build`. Editing the page cannot break the tool.

## Deploy to Vercel

Import this repository at [vercel.com/new](https://vercel.com/new) and set:

| Setting | Value |
| --- | --- |
| Framework Preset | **Other** |
| Root Directory | **`web`** |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |

Root Directory is the only field that matters — it stops Vercel from trying to build the
CLI at the repo root.

Or from the CLI:

```bash
npm i -g vercel
cd web
vercel --prod
```

## Local preview

```bash
cd web
python3 -m http.server 4000
# http://localhost:4000
```

## Keeping it honest

The page mirrors the root `README.md`. If the tool changes, these need updating with it:

- **Install section** — currently says "not on npm yet" and documents the clone + `npm link`
  flow. Change it if the package gets published.
- **Risk rules table** — mirrors the High / Medium rules exactly.
- **Sample report values** — taken from the README's own sample output
  (`run_20260529T192518Z_cfnq9r`, `npm test` failing at 12s, `src/auth.ts`, `package.json`),
  so the page never shows behaviour the tool does not have.
- **Command count** — the page says "8 commands total"; that matches the command table.

## Fonts

Loaded from Google Fonts (JetBrains Mono) and Fontshare (Clash Display). Those are the only
outbound requests the page makes. The page is otherwise fully self-contained — no CDN
scripts, no analytics, no tracking, consistent with the tool's no-telemetry stance.
