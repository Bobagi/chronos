# Chronos – Mythological Card Game Engine (Backend)

**Chronos** is the backend engine for a multiplayer online card game inspired by mythology and classic battle card mechanics (inspired by Dracomania). This service handles all game rules, player logic, turn rotation, card resolution, and battle flow.

## 🛠 Tech Stack

- [NestJS](https://nestjs.com/) (TypeScript)
- REST API + Swagger
- PostgreSQL + Prisma ORM
- Docker-ready

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

> Generates and applies the migration; files appear under `prisma/migrations/`.

---

## 🗄 Prisma Studio (DB UI)

```bash
docker exec -it chronos-backend npx prisma studio --port 5555 --hostname 0.0.0.0 --browser none
```

Open: `http://localhost:5555`

---

## 🧪 Quick API Checks

**Health/test**

```bash
curl -k http://localhost:3053/game/test
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
