# Chronos Unified Application

This repository contains the unified Chronos application: a single Node.js project that serves the NestJS backend and the SvelteKit frontend from one codebase. The UI remains unchanged; only the structure has been consolidated into one deployable root project.

## Project layout (root-only)

- `server/` — NestJS backend, Prisma schema, and WebSocket gateway.
- `client/` — SvelteKit frontend (unchanged visuals).
- `shared/` — Shared domain types and constants used by both client and server.
- `.env.example` — Single root environment example (copy to `.env`).

## Local development (dev)

### Requirements

- Node.js 20+
- npm 10+
- Docker (for PostgreSQL) or a local Postgres 15 instance

### 1) Configure environment variables

```bash
cp .env.example .env
```

Update the values in `.env` as needed.

### 2) Install dependencies

```bash
npm install
```

### 3) Start PostgreSQL locally (Docker)

```bash
docker compose up -d db
```

The database listens on `localhost:5432` by default (see `.env.example`).
If you change `POSTGRES_USER` or `POSTGRES_PASSWORD` in `.env` after the first run, you must reset the database volume or the credentials will not update.
To reset locally:

```bash
docker compose down -v
docker compose up -d db
```

### 4) Apply migrations and seed data

```bash
npx prisma migrate dev --schema server/prisma/schema.prisma
npx prisma db seed --schema server/prisma/schema.prisma
```

### 5) Run the unified dev stack

```bash
npm run dev
```

### Access points

- Frontend (SvelteKit dev server): `https://localhost:3055`
- Backend REST API: `http://localhost:3000`
  - Example routes: `/auth`, `/game`, `/friends`, `/health`
- WebSocket (Socket.IO): `ws://localhost:3000` (same origin as the API)

## Production build

### 1) Build the unified application

```bash
npm run build
```

### 2) Run in production mode

```bash
npm run start
```

This runs the NestJS API (default `PORT=3000`) and the SvelteKit Node server (default `CLIENT_PORT=3055`).

## VPS deployment (single unified app)

### 1) Copy project files

```bash
rsync -av --exclude node_modules --exclude .git ./ user@your-vps:/srv/chronos
```

### 2) Configure environment variables

```bash
cp /srv/chronos/.env.example /srv/chronos/.env
```

Set all required values in `/srv/chronos/.env`:
- `PORT` (backend)
- `CLIENT_PORT` (frontend)
- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `VITE_API_BASE_URL`
- `CLIENT_ORIGIN`

### 3) Install dependencies and build

```bash
cd /srv/chronos
npm install
npm run build
```

### 4) Start the database (choose one)

**Option A — Docker compose (recommended for a simple VPS):**

```bash
docker compose up -d db
```

**Option B — External PostgreSQL:**

Point `DATABASE_URL` to your managed database and ensure the user has permissions.

### 5) Run as a service (systemd example)

Create `/etc/systemd/system/chronos.service`:

```
[Unit]
Description=Chronos Unified App
After=network.target

[Service]
WorkingDirectory=/srv/chronos
EnvironmentFile=/srv/chronos/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=append:/var/log/chronos.log
StandardError=append:/var/log/chronos-error.log

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable chronos
sudo systemctl start chronos
```

### 6) Open ports

- `3000` (backend API + WebSocket)
- `3055` (frontend)
- `5432` only if the database is exposed externally (not required for most VPS setups)

### 7) Verify health

```bash
curl http://localhost:3000/health
```

Expect a healthy response from the backend. For the frontend, open `http://your-vps:3055`.

## Notes

- All commands run from the repository root.
- The UI code remains unchanged; this rewrite only unifies structure and deployment.
