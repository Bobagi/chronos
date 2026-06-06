# CLAUDE.md — Chronos

> **SESSION PROTOCOL — follow automatically, every time, without being reminded:**
>
> 1. **Trust this file before exploring.** It is auto-loaded whenever you read any file
>    under `/opt/chronos`, and the machine's `/root/CLAUDE.md` already tells you to read a
>    repo's own `CLAUDE.md` first. Don't re-discover what's documented here.
> 2. **Keep it current — treat a stale CLAUDE.md as a bug.** Whenever a task changes the
>    architecture, file map, commands, deploy steps, gotchas, or the Status section, update
>    this file **in the same commit as the code change**. This is a standing instruction; do
>    it without the user asking.

Guidance for Claude Code working in this repo. All code, comments and UI text are
**English**; use intuitive names.

## What Chronos is

A digital collectible card game (the **Dracomania** collection — dragons & fantasy), built as
the owner's (Gustavo Perin / "Bobagi") portfolio piece. It is **one project**:

- **Backend** — NestJS game engine at the repo root (`src/`), Prisma + Postgres. Runs in Docker.
- **Frontend** — SvelteKit app in `web/` (`@sveltejs/adapter-node`). Talks to the backend
  **server-side** via a proxy (`/api/chronos/*`), so the browser only hits its own origin (no CORS).

The former separate `kairos` frontend was merged into `web/` and retired. Repo:
`https://github.com/Bobagi/chronos`. Live: `https://chronos.bobagi.space`.

The main mode is **Attribute Duel** (`mode = ATTRIBUTE_DUEL`): each round both duelists reveal one
card and clash on one attribute (**magic / might / fire**); the round winner captures both cards into
their discard pile; whoever captured more cards when a hand empties wins the match. There's a legacy
`CLASSIC` mode too, but Attribute Duel is the focus.

## Runtime / deploy reality (confirmed on the VPS)

| Part | Where | How it runs | Port |
|---|---|---|---|
| Frontend | `/opt/chronos/web` (`build/index.js`) | **PM2** app `chronos-web` | 127.0.0.1:**3055** |
| Backend | Docker `chronos-backend` (image `chronos-chronos`) | `docker compose` service `chronos` | host **3056** → container 3000; also 5555 (Prisma Studio) |
| Database | Docker `chronos-db` (postgres:15) | `docker compose` service `db` | host **5434** → 5432 |
| nginx | `/etc/nginx/sites-available/chronos.bobagi.space` | proxies `/` → 127.0.0.1:3055 | :80/:443 |

- **Node is 18.20.5 via nvm; pnpm 9.15.9.** (`.nvmrc` says 20 but only 18 is installed.) The web build
  needs `npm_config_engine_strict=false` to tolerate that.
- Card art is served from `https://bobagi.space/images/cards/<number>.png`
  (backend prepends `CARD_IMAGE_BASE_URL`, default `https://bobagi.space`, in `CardRepository`).

### Deploy the FRONTEND (after editing anything in `web/`)
```bash
cd /opt/chronos/web
bash -lc 'source ~/.nvm/nvm.sh; export npm_config_engine_strict=false; pnpm run build'   # ~10-18s
pm2 restart chronos-web --update-env && pm2 save
```
PM2 serves the built `build/` — **you must rebuild + restart** for changes to show. CSS/markup-only
changes don't need anything else.

### Deploy the BACKEND (after editing anything in `src/`, `prisma/`)
```bash
cd /opt/chronos
docker compose build chronos          # nest build runs inside node:20 (no nvm needed)
docker compose up -d chronos           # recreate; waits for db healthy; re-runs idempotent seed
# wait for health:
curl -s http://localhost:3056/health   # -> {"status":"ok",...}
```
Source formatting changes alone don't require a backend rebuild (compiled behavior is identical).

## Project layout (what matters)

```
src/                         NestJS backend
  game/
    game.module.ts           wires the providers below
    game.controller.ts       REST: /game/* (start, state, duel actions, cards, collections, stats)
    game.service.ts          facade: game lifecycle, delegates to the services below
    duel-game.service.ts     ATTRIBUTE_DUEL rules (choose card/attribute, reveal, advance, bot AI)
    classic-game.service.ts  CLASSIC mode
    card.repository.ts        card catalog reads + image-base rewriting (repository pattern)
    game-collection.repository.ts  collection reads
    game.types.ts            DuelCenterState + serialize/deserializeDuelCenter (JSON <-> Prisma)
  auth/ friends/ health/ prisma/   feature modules
prisma/schema.prisma         Postgres schema;  prisma/seed.ts  idempotent seed (Dracomania, users)
web/                         SvelteKit frontend
  src/lib/styles/appShell.css        GLOBAL design system: tokens, atmospheric bg, Draco font,
                                     themed top bar/footer, shared .button/.input. Loaded by +layout.
  src/routes/mainpage.css            home (landing/login hero + player dashboard) layout
  src/routes/+layout.svelte          renders TopBar/SiteFooter — HIDDEN on /game routes (chromeless)
  src/routes/+page.svelte            home: logged-out hero+login / logged-in dashboard
  src/routes/gallery/+page.svelte    card collection showcase
  src/routes/register/+page.svelte
  src/lib/components/FriendsPanel.svelte   friends modal (search/requests/roster/chat)
  src/lib/components/CardComposite.svelte  renders one card (art + frame + MAGIC/MIGHT/FIRE badges)
  src/lib/components/DeckStack.svelte      stacked deck of card backs
  src/lib/components/DuelHistory.svelte    Hearthstone-style scrollable battle log
  src/routes/game/duel/[id]/+page.svelte   THE DUEL SCREEN (orchestration + template)
  src/routes/game/*.css                    duel board styles (board/zones/hands/effects/...)
  src/lib/styles/routes/gameDuelPage.css   duel page-specific styles (battlefield, banners, endscreen)
  src/lib/duel/                            pure duel logic extracted from the page:
      defeatAnimation.ts   canvas particle "defeat" effect (fire/magic/might)
      duelCenter.ts        normalizeDuelCenterForView + detectChosenAttributeMode
      history.ts           battle-log parsing + live-round synthesis
      historyTypes.ts      shared types
  src/lib/api/                             client + proxy to the backend
```

## Architecture gotchas (important — learned the hard way)

- **Duel center shape mismatch.** The backend persists/returns the duel center with INTERNAL keys
  (`playerACardCode`, `playerBCardCode`, `roundWinnerId`, `isRevealed`, `playerAAttributeValue`…),
  but the UI uses the PUBLIC shape (`aCardCode`, `bCardCode`, `roundWinner`, `revealed`, `aVal`,
  `bVal`). The duel page normalizes via `normalizeDuelCenterForView` (in `web/src/lib/duel/duelCenter.ts`).
  If you touch duel-center fields, keep both ends in sync.
- **serialize/deserialize keys must match.** In `src/game/game.types.ts`, `serializeDuelCenter` and
  `deserializeDuelCenter` must read/write the SAME keys. A past bug read `roundWinner` while writing
  `roundWinnerId`, so every round scored as a draw and matches were unwinnable. Deserialize now reads
  `roundWinnerId` (with `roundWinner` fallback).
- **Client auto-resolves on a 10s turn timer.** The duel page auto-picks a card/attribute when the
  per-turn deadline passes (`TURN_DURATION_MS = 10_000`). For manual/browser testing, act within ~10s
  of creating the game or it will auto-advance through rounds on its own.
- **Game routes are chromeless.** `+layout.svelte` hides the global TopBar/footer on `/game/*`; the
  board owns the viewport (`height: 100dvh`, no page scroll). Card sizes are viewport-height based so
  both hands + the battlefield fit one screen; the battle log scrolls inside its own panel.
- **Prettier:** the repo's `prettier-plugin-svelte` crashes on Prettier **3.8** (`getVisitorKeys`).
  Format with a compatible version: `npx --yes prettier@3.6.2 --write .` (run inside `web/` and at the
  repo root). `web/pnpm-lock.yaml` is untracked by design — don't commit it.

## Verifying changes

- **API smoke (fast, no browser):** start a duel, choose a card, choose the winning attribute:
  ```bash
  ADMIN=$(docker exec chronos-db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c \
    "SELECT id FROM \"Player\" WHERE username='admin'")   # (load .env first)
  GID=$(curl -s -XPOST localhost:3056/game/start-duel -H 'Content-Type: application/json' \
    -d "{\"playerAId\":\"$ADMIN\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["gameId"])')
  curl -s localhost:3056/game/state/$GID            # inspect duelStage + duelCenter
  ```
- **Browser (Playwright is installed, chromium headless):** drive `https://chronos.bobagi.space` or
  navigate directly to `/game/duel/<id>` (state fetch + duel actions are unauthenticated) and
  screenshot. Import via `createRequire('/opt/chronos/web/')('playwright')`.

## Conventions & rules

- **Don't reset the database.** It's seeded (idempotent) with the Dracomania collection (32 cards) and
  users `admin` (ADMIN) / `alice`. Creating throwaway test games/users is fine; they age out (admin
  "Expire old games" button) — but direct DB mutations are restricted, so prefer the app's own endpoints.
- **Secrets:** `.env` (backend) and `web/.env` hold DB creds / API base. Never print, echo, or commit them.
- **Don't touch other VPS services** (rhyme, umami, todo, etc.) — see `/root/CLAUDE.md` for the machine map.
- **Commits:** end messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Work on
  `main` (current convention) or `feat/*`; confirm before destructive git/DB actions.

## Status (update as you go)

- Attribute Duel is fully playable end-to-end (the round-winner bug is fixed; matches resolve a winner).
- Whole-app UI redesign done (dark-fantasy gold theme): landing/login, dashboard, friends modal,
  gallery, and the single-screen duel board with a scrollable battle log and Hearthstone-style hand
  hover highlight.
- Backend follows NestJS layered architecture (modules/services/repositories/DTOs/guards); the duel
  page was decomposed into `web/src/lib/duel/*` modules.
