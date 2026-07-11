# Soarscore

Scoring and running system for RC glider competitions. See
`docs/requirements/` for the domain and decisions this code implements.

## Layout

- `packages/shared` — domain types, event contracts, Zod schemas shared by
  both apps.
- `apps/base` — the Base Station server (Fastify + SQLite). Authoritative
  state; append-only event log; serves the companion UI's built assets.
- `apps/companion` — the operator web app (Vite + React), built to static
  assets and served by the base.

## Development

Requires Node ≥ 22 and npm workspaces.

```sh
npm install
npm run dev     # base server (tsx watch, :3000) + Vite dev server (:5173), together
npm run build   # builds shared, then companion assets, then the base server
npm test        # runs all workspace test suites (Vitest)
npm run lint    # ESLint across the monorepo
```

`npm run dev` starts both processes concurrently. Open `http://localhost:5173`
— Vite proxies `/api/*` to the base server on `:3000`.

The SQLite data file lives under `SOARSCORE_DATA_DIR` (default `./data`),
created on first run.
