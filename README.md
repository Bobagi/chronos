# Chronos Platform Monorepo

This repository hosts the Chronos platform as a monorepo, combining the NestJS backend (Chronos) and the SvelteKit frontend (Kairos) with a shared package for common domain types.

## Repository layout

- `apps/chronos/` – NestJS backend with Prisma and PostgreSQL integrations.
- `apps/kairos/` – SvelteKit frontend for the online card experience.
- `packages/shared/` – Shared domain contracts (types, enums, constants) consumed by both applications.
- `docker-compose.yml` – Orchestration entry point for the backend and database services.

## Environment files

Create environment files at the repository root:

- `.env.chronos` – Backend and database variables used by Docker Compose (see `apps/chronos/README.md`).
- `.env.kairos` – Frontend-specific variables (for SSR hosting or future container builds).

## Running the backend with Docker

Use the root-level `docker-compose.yml` to start PostgreSQL and the Chronos API:

```bash
docker compose up -d db chronos
```

The compose file builds the backend from `apps/chronos/` and mounts its Prisma schema for migrations and seeding.

## Shared code

Types, enums, and domain constants are centralized in `packages/shared`. Both the backend and frontend import from `@chronos/shared` to avoid duplication and keep contracts consistent across the platform.

## Frontend (Kairos)

The Kairos SvelteKit application lives in `apps/kairos/` with routes, components, and service clients organized under `src/`. It consumes backend contracts from `@chronos/shared` and remains ready for SSR deployment.

## Backend (Chronos)

The Chronos NestJS application lives in `apps/chronos/`. See `apps/chronos/README.md` for detailed instructions on running locally or with Docker, migrations, and API exploration.
