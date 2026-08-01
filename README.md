# TripList 🏕️

Layered packing lists for every kind of trip. Instead of one giant checklist, gear lives on
**lists** (Always, Kitchen, Fire, Water, Festival, …) and a trip is built by stacking the layers
that match it — picked through a card-based wizard.

## Running

```sh
npm install
npm run dev
```

## How it works

- **Plan My Trip** — a card wizard (trip style → site conditions → crew) where each card
  contributes a set of lists; the union of tagged gear becomes the trip's packing list.
- **My Trips** — packing checklists grouped by category, with progress tracking, per-trip
  add/remove of items, and editable list layers after creation.
- **Gear & Lists** — manage the gear catalog (name, quantity owned, list membership) and the
  lists themselves (name, icon, description).

Wizard cards are defined in `src/data/seed.ts` (`wizardSteps`) — edit the `tags` array on a card
to change which lists it pulls in.

## Data

- Seed gear comes from the original spreadsheet, generated into `src/data/seed-items.ts`.
- All state (gear, lists, trips) persists to `localStorage` under the key `triplist-v1`.
  The whole app state is one serializable document (`{ items, tags, trips }`), deliberately kept
  flat so a future sync backend (shared lists / group planning) can replace the localStorage
  layer without touching the UI.

## Stack

Vite · React 18 · TypeScript · Tailwind CSS 4 · framer-motion · lucide-react
Express server (`server/index.mjs`) serving the built SPA + `/api/health`.

## Deployment

Hosted on Fly.io (app `triplist`, region sjc) with Fly Managed Postgres (`triplist-db`)
attached as `DATABASE_URL` — the future backing store for shared lists / group planning.
DNS lives in Cloudflare, pointed at Fly (grey-cloud/DNS-only; Fly terminates TLS).

- Merges to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`,
  authenticated by the `FLY_API_TOKEN` repo secret — a deploy token scoped to the app).
- Manual deploy: `fly deploy --remote-only`.
