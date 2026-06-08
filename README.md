# Cartomania – Digital Collectible Card Game (Backend + Web)

**Cartomania** (formerly _Chronos_) is a digital collectible card game. The current set is the
**Dracomania** collection (dragons & fantasy), and the project is built to host multiple collections
(Dracomania, Mythomania, and custom player collections). It is **one project**: the NestJS game engine
(this repo root) plus the SvelteKit browser frontend in [`web/`](./web) — landing/login, card gallery,
player dashboard (avatars + account settings), friends and matches. The former separate `kairos`
frontend was merged in here and retired.

> The product is branded **Cartomania** (repo `cartomania`), but the code identifiers, the live domain
> (`chronos.bobagi.space`) and the infra names (Docker `chronos-*`, PM2 `chronos-web`, the DB, the
> `/api/chronos/*` proxy) still use `chronos` internally.

The main mode is **Attribute Duel**: each round both duelists reveal a card and clash on one attribute
(magic / might / fire); the round winner captures both cards into their discard pile, and whoever
captured more cards when a hand empties wins the match. A legacy `CLASSIC` mode also exists. The UI is
available in English, Portuguese and Spanish.

This backend handles all game rules, player logic, turn rotation, card resolution, and battle flow.

## 🛠 Tech Stack

- [NestJS](https://nestjs.com/) (TypeScript)
- REST API + Swagger
- PostgreSQL + Prisma ORM
- Docker-ready
- SvelteKit web frontend in [`web/`](./web)

---

## 🌐 Web frontend (`web/`)

The browser app (SvelteKit, `@sveltejs/adapter-node`) lives in [`web/`](./web). It serves the
landing/login, card gallery, player dashboard (avatars + account settings), friends and matches, and
talks to this backend **server-side** via its `/api/chronos/*` proxy (default base
`http://localhost:3053`) — so the browser only ever hits the front's own origin.

```bash
# dev (two terminals)
npm run start:dev                          # backend on :3053
cd web && pnpm install && pnpm run dev     # front on :5173

# production build
cd web && pnpm install && pnpm run build   # outputs web/build (adapter-node)
node web/build/index.js                     # serves the front (PM2: chronos-web, :3055)
```

Deploy (VPS): nginx routes `chronos.bobagi.space` → the front (`:3055`); the front proxies to the
backend on `127.0.0.1:3053`. Set `VITE_API_BASE_URL` at build time only if the backend is not on `:3053`.

---

## ▶️ Run Locally (without Docker)

1. Create a `.env` file using the variables listed in the Docker section.
2. Install dependencies with your preferred package manager, for example `npm install`.
3. Start the development server with `npm run start:dev` and access the API at `http://localhost:3053`.

---

## 📦 Features

- Create and manage a match between 2 players
- Track game state, logs, turns, HP, and player hands
- Each player starts with 5 random cards in hand
- Only cards in hand can be played
- REST endpoints for game actions
- Swagger docs at `/api`

---

## 🚀 Run with Docker

### 1) `.env` (root)

```env
CHRONOS_PORT=3053
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chronos
DATABASE_URL=postgresql://postgres:postgres@db:5432/chronos
```

### 2) Start services

```bash
docker compose up -d db chronos
```

### 3) API base URL

```
http://localhost:3053
```

---

## 📜 Create Migration (exact commands)

```bash
docker compose up -d db chronos
docker compose exec chronos sh -lc 'npx prisma migrate dev --name add-new-game-mode'
```

In case of 'We found changes that cannot be executed':

```bash
docker compose exec chronos sh -lc 'npx prisma migrate dev --name add_auth_player_role --create-only'
docker compose exec chronos sh -lc 'npx prisma migrate reset --force --skip-seed'
```

Then, generate files:

```bash
docker compose exec chronos sh -lc 'npx prisma generate'
```

---

## 🗄 Prisma Studio (DB UI)

```bash
docker exec -it chronos-backend npx prisma studio --port 5555 --hostname 0.0.0.0 --browser none
```

```bash
ssh -L 5555:127.0.0.1:5555 user@host
```

Open: `http://localhost:5555`

---

## 🧪 Quick API Checks

**Health**

```bash
curl -k http://localhost:3053/health
```

**Start a new game**

```bash
curl -k -X POST http://localhost:3053/game/start
```

**Play a card**

```bash
curl -k -X POST http://localhost:3053/game/play-card \
  -H "Content-Type: application/json" \
  -d '{"gameId":"550e8400-e29b-41d4-a716-446655440000","player":"A","card":"fireball"}'
```

---

## 📘 Swagger

```
http://localhost:3053/api
```

---

## 🔄 Reset DB and Seed (optional)

```bash
docker compose exec chronos sh -lc 'npx prisma migrate reset --force'
docker compose exec chronos sh -lc 'npx ts-node prisma/seed.ts'
```
