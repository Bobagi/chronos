# Chronos Unified Card Game Platform

Chronos is a single, unified application that hosts both the game API and the SvelteKit-powered
frontend in one deployment. The goal is to keep the original gameplay, matchmaking, and UI
behavior intact while removing the legacy backend/frontend split.

## Repository layout

- `server/` – NestJS backend (authentication, matchmaking, game sessions, real-time services).
- `src/` – SvelteKit frontend (routes, components, UI state, and SSR hooks).
- `shared/` – Shared domain contracts (types, enums, constants) used by both layers.
- `prisma/` – Database schema, migrations, and seed data.
- `static/` – Static assets for the SvelteKit frontend.

## Local development

### Start both the API and UI (watch mode)

```bash
npm install
npm run dev
```

- The API runs on `http://localhost:3000`.
- The Vite dev server runs on `http://localhost:3055` and proxies API calls to the API server.

### Build everything

```bash
npm run build
```

### Run the unified production server

```bash
npm run start
```

The production server renders the SvelteKit frontend from the same NestJS process and serves
static assets from `dist/client`.

## Docker

The Docker setup now builds a single image that includes both the backend and frontend:

```bash
docker compose up --build
```

This starts PostgreSQL plus the unified Chronos application.

## Database access

Prisma Studio can be run inside the container:

```bash
docker compose exec chronos bash
npx prisma studio --port 5555 --hostname 0.0.0.0 --browser none
```

If you need remote access, open an SSH tunnel to the container IP:

```bash
ssh -N -L 5555:<container-ip>:5555 <user>@<server>
```

Then visit `http://localhost:5555` in your browser.
