# Kairos Web Client

This project is the web frontend for the Chronos ("Chronoes") game service and now lives under
`apps/kairos` inside the shared Chronos monorepo. The application expects a Chronos API instance to
be running locally so it can proxy requests during development and call the same base URL in
production builds.

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Chronos backend running from `apps/chronos` in this repository
- Local HTTPS certificates located in `certs/localhost.pem` and `certs/localhost-key.pem` (already
  committed for development)

## 1. Start the Chronos backend locally

1. From the monorepo root, install backend dependencies inside `apps/chronos`: `pnpm install` (or
   `npm install`).
2. Configure Chronos environment variables in `.env.chronos` at the repository root.
3. Run Chronos on `https://localhost:4000` (or another port of your choice):
   ```bash
   pnpm run dev -- --host 0.0.0.0 --port 4000 --https
   ```
5. Confirm the API is reachable:
   ```bash
   curl -k https://localhost:4000/health
   ```

> If you use a different port, remember it for the Kairos `VITE_API_BASE_URL` variable.

## 2. Configure Kairos to talk to Chronos

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create a `.env.kairos` file in the repository root (or `.env.local` inside `apps/kairos`) and
   set the Chronos base URL:
   ```bash
   VITE_API_BASE_URL=https://localhost:4000
   ```
   When you run the dev server, Vite reads this variable and uses it in two places:
   - it proxies `/auth` and `/game` requests to the Chronos server;
   - it becomes the base URL for API calls once you build the project for production.
3. Trust the TLS certificate found in `certs/localhost.pem` (or replace it with one trusted by your
   OS/browser) so the browser accepts the HTTPS connection.

## 3. Run Kairos in development mode

```bash
pnpm run dev -- --host 0.0.0.0 --port 3055
```

- The app serves over HTTPS on `https://localhost:3055`.
- All API calls go through the Vite proxy to `https://localhost:4000` (or whichever URL you
  configured).

## 4. Build for production

```bash
pnpm run build
pnpm run preview
```

Before deploying the production build, make sure the environment that serves the compiled output
provides the same `VITE_API_BASE_URL` so the client knows where to reach Chronos.
