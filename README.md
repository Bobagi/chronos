# Chronos – Mythological Card Game Engine (Backend)

**Chronos** is the backend engine for a multiplayer online card game inspired by mythology and classic battle card mechanics (inspired by Dracomania). This service handles all game rules, player logic, turn rotation, card resolution, and battle flow.

## 🛠 Tech Stack
- [NestJS](https://nestjs.com/) – backend framework (TypeScript)
- REST API + Swagger for testing
- PostgreSQL + Prisma ORM
- Deployment: GitHub Codespaces / Docker-ready

---

## 📦 Features
- Create and manage a match between 2 players
- Track game state, logs, turns, HP, and player hands
- Each player starts with 5 random cards in hand
- Only cards in hand can be played
- REST endpoints for game actions
- Swagger docs available at `/api`

---

## 🚀 Running Locally with Docker

### 1. Create `.env` file in the project root:
```env
CHRONOS_PORT=3053
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=chronos
DATABASE_URL=postgresql://postgres:postgres@db:5432/chronos
```

### 2. Build and start services:
```bash
docker compose up --build
```

### 3. API will be available at:
```
http://localhost:3053
```

---

## 🗄 Accessing Prisma Studio (Database UI)

Run inside your terminal:
```bash
docker exec -it chronos-backend npx prisma studio --port 5555 --hostname 0.0.0.0 --browser none
```

Then open in your browser:
```
http://localhost:5555
```

---

## 🧪 Testing the API

**Test server:**
```bash
curl -k http://localhost:3053/game/test
```

**Start a new game:**
```bash
curl -k -X POST http://localhost:3053/game/start
```

**Play a card:**
```bash
curl -k -X POST http://localhost:3053/game/play-card \
  -H "Content-Type: application/json" \
  -d '{"gameId":"550e8400-e29b-41d4-a716-446655440000","player":"A","card":"fireball"}'
```

---

## 📘 Swagger Documentation
After running:
```
http://localhost:3053/api
```

---

## 🔄 Reset Database and Run Seed (No Duplicate Error)
```bash
docker exec -it chronos-backend npx prisma migrate reset --force
docker exec -it chronos-backend npx ts-node prisma/seed.ts
```
