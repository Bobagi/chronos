# Chronos – Mythological Card Game Engine (Backend)

The `apps/chronos` directory hosts **Chronos**, the NestJS backend for the multiplayer online card game platform. Chronos is the source of truth for players, card collections, and active matches.

## 🛠 Tech Stack

- [NestJS](https://nestjs.com/) (TypeScript)
- REST API + Swagger
- PostgreSQL + Prisma ORM
- Docker-ready

---

## ▶️ Run Locally (without Docker)

1. From the repository root, create a `.env.chronos` file using the variables listed in the Docker section.
2. Install dependencies inside `apps/chronos` with your preferred package manager (for example `npm install`).
3. Start the development server with `npm run start:dev` from `apps/chronos` and access the API at `http://localhost:3053`.

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

### 1) `.env.chronos` (repository root)

```env
CHRONOS_PORT=3053
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chronos
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
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
