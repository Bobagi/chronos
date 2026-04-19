# Chronos Fullstack (Backend + Frontend)

Single-repository fullstack project (NestJS backend + integrated browser frontend at `/`).

## Run with one command

```bash
npm install && npm run start:dev
```

Open:
- Web app: `http://localhost:3000/`
- Swagger API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/health`

## Web app features

- Authentication: login, register, persisted session
- Authenticated user profile
- Card gallery and collections
- Social system: search, friend request, accept/reject, remove, block
- Friend chat
- Matches: start vs BOT, start vs friend, list active matches
- Game modes: `CLASSIC` and `ATTRIBUTE_DUEL`
- Gameplay actions (play card, skip turn, duel flow, surrender)

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

```bash
cp .env.example .env
```

## Database

Prisma requires `DATABASE_URL` in `.env`.

Optional seed:

```bash
npx prisma db seed
```

## GitHub Codespaces (quick local run)

1. Open this repository in Codespaces.
2. In the terminal run:
   ```bash
   cp .env.example .env
   npm install
   npm run start:dev
   ```
3. Open the forwarded port `3000` in the browser.

## Docker Compose

Use the same `.env` file and run:

```bash
docker compose up --build
```

The app is exposed on `http://localhost:${CHRONOS_PORT}` (default `3000`).

