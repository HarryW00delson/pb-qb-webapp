# pb-qb-webapp

A full-stack web app for searching **movies and TV shows**: **React + Vite** client, **Node.js/Express + TypeScript** server, an optional **Dockerized PostgreSQL** database (via Prisma), and **Docker** support for upper environments. Local development runs natively (Vite + tsx watch) — no containers required day-to-day.

## Stack

- **Client**: React 19, Vite, TypeScript, Vitest + Testing Library
- **Server**: Express 5, TypeScript, tsx (dev watch mode), Vitest + Supertest
- **Database (optional)**: PostgreSQL via Prisma ORM — disabled by default, zero config required unless you opt in
- **Monorepo**: npm workspaces (`client/`, `server/`)
- **Tooling**: ESLint (flat config) + Prettier shared across workspaces, GitHub Actions CI
- **Containers**: Multi-stage Dockerfiles + Docker Compose, intended for staging/production-like environments — not local dev
- **License**: GPL-3.0

## Current status

This project is a work in progress. Today it provides:

- A client search UI — search form plus a live server-status indicator — backed by two server endpoints:
  - `GET /api/health` — liveness check.
  - `GET /api/web-sources` — the configured search sources (from the `WEB_SOURCES` env var), listed under the search form.
- An **optional** sample `/api/notes` list/create route pair demonstrating Prisma/PostgreSQL wiring (disabled by default; see below).

Not yet implemented: the actual search — submitting the form currently only logs the query to the console. The plan is to add server-side search against the configured web sources and render the results in the client.

## Prerequisites

- Node.js `24.x` (see `.nvmrc`; `nvm use` will pick it up) and npm `>=10`
- Docker + Docker Compose, only if you want to run the containerized stack or the optional database

## Getting started (local development)

```bash
nvm use            # or otherwise ensure Node 24.x is active
npm install         # installs all workspaces from the repo root
cp server/.env.example server/.env   # see "Configuration" below
```

Run the client and server in separate terminals, each with hot-reload:

```bash
npm run dev:server   # Express API on http://localhost:3001 (tsx watch)
npm run dev:client   # Vite dev server on http://localhost:5173 (HMR)
```

The Vite dev server proxies `/api/*` requests to the Express server, so the client can call `fetch('/api/health')` etc. without CORS issues in dev.

## Repository layout

```
.
├── client/            React + Vite app
├── server/            Express + TypeScript API
│   ├── src/
│   │   ├── config/env.ts   Centralized, validated environment config (zod)
│   │   ├── db/client.ts    Lazy Prisma client factory (optional DB)
│   │   ├── routes/notes.ts Sample list/create routes demonstrating DB wiring
│   │   ├── app.ts          Express app factory (security middleware, routes)
│   │   └── index.ts        Real entrypoint (env loading, graceful shutdown)
│   └── prisma/schema.prisma
├── docker-compose.yml  Server + client (+ optional db) for containerized runs
├── .github/workflows/ci.yml
├── .env.example        Root-level: Docker Compose Postgres secrets
└── server/.env.example App-level: server runtime config/secrets
```

## Available scripts

Run from the repo root (applies to both workspaces where relevant):

| Script                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev:client`   | Start the Vite dev server (HMR)                            |
| `npm run dev:server`   | Start the Express server with tsx watch (auto-restart)     |
| `npm run build`        | Build both workspaces (server also runs `prisma generate`) |
| `npm run test`         | Run Vitest in both workspaces                              |
| `npm run lint`         | Lint the whole repo (single shared ESLint flat config)     |
| `npm run format`       | Format the whole repo with Prettier                        |
| `npm run format:check` | Check formatting without writing changes (used in CI)      |

## Configuration & secrets (OWASP-aligned)

Secrets and environment-specific config are **never hard-coded**. They're loaded from environment variables, populated locally via gitignored `.env` files or injected by your platform/orchestrator in real deployments. There are **two separate `.env` files** with different scopes:

- `server/.env` (from `server/.env.example`): app-level runtime config for the server itself — `NODE_ENV`, `PORT`, `WEB_SOURCES` (comma-separated list of the search sources exposed via `GET /api/web-sources`), `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY`, rate-limit settings, and `DATABASE_ENABLED`/`DATABASE_URL` when running the server **natively**.
- `.env` at the repo root (from `.env.example`): Docker Compose-level Postgres secrets (`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`) and `DATABASE_ENABLED`, used only when running the containerized stack via `docker-compose.yml`.

- All config is validated at startup with `zod` (`server/src/config/env.ts`) — the server **fails fast** (non-zero exit) if required values are missing or malformed, rather than behaving unpredictably later.
- `CORS_ALLOWED_ORIGINS` must be an explicit allowlist (no wildcard `*`); required in production.
- `TRUST_PROXY` is opt-in and off by default — only enable it when a real reverse proxy sits in front of the app, otherwise clients could spoof `X-Forwarded-For` and bypass rate limiting.
- Baseline hardening via `helmet()`, a strict CORS allowlist, and `express-rate-limit` is always on.
- `.env` (and any `.env.*` variant) is gitignored everywhere except `.env.example` files, which contain no real secrets — copy them and fill in real values locally, or set the equivalent environment variables directly in upper environments.

## Optional database (PostgreSQL + Prisma)

The app runs with **zero database configuration by default** — nothing attempts to connect to Postgres unless you explicitly opt in. This is a config setting, not a code fork.

To enable the sample `/api/notes` routes:

1. Start a local Postgres (either via the bundled Compose service, see below, or one you already have).
2. In `server/.env`, set:
   ```
   DATABASE_ENABLED=true
   DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
   ```
3. Apply migrations: `npm run db:migrate:dev --workspace server`
4. `GET`/`POST /api/notes` are now live.

### Running Postgres via Docker Compose (for native local dev)

```bash
cp .env.example .env   # root-level: POSTGRES_USER/PASSWORD/DB + DATABASE_ENABLED
docker compose --profile db up -d db
```

This starts only the `db` service, bound to `127.0.0.1:5432`, so your **natively-running** server (via `npm run dev:server`) can connect and run Prisma migrations against it — no need to containerize the app itself for local dev.

## Running the full stack in containers (staging/production-like)

Docker is intended for upper environments, not local day-to-day development.

```bash
docker compose up -d              # server + client only, no database
```

To include the database, populate the root `.env` first (Compose reads `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`DATABASE_ENABLED` from it — see "Configuration & secrets" above):

```bash
cp .env.example .env
# edit .env: set a real POSTGRES_PASSWORD and DATABASE_ENABLED=true
docker compose --profile db up -d # server + client + Postgres
```

- The client is served via nginx (running as a non-root user via `nginxinc/nginx-unprivileged`) on `http://localhost:8080` and reverse-proxies `/api/*` to the server.
- The server has **no public port mapping** — it's only reachable through nginx, which is what makes `TRUST_PROXY=true` (set for the server in `docker-compose.yml`) safe in this topology.
- Both images use multi-stage builds and run their runtime processes as non-root users.

## Testing

- `server`: Vitest + Supertest against the Express app factory (`createApp(env, deps)`), including CORS, rate-limiting, and env-validation tests. Database-dependent routes are tested with an injected mock `PrismaClient` — no live database needed to run the suite.
- `client`: Vitest + Testing Library, including an abort-on-unmount test for the health-check fetch.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push/PR to `main`: install, format check, lint, build, and test, using the Node version pinned in `.nvmrc`.

## License

GPL-3.0 — see `LICENSE`.
