# TripList 🏕️

Layered packing lists for every kind of trip. Instead of one giant checklist, gear lives on
**lists** (Always, Kitchen, Fire, Water, Festival, …) and a trip is built by stacking the layers
that match it — picked through a card-based wizard.

## Running

```sh
make setup   # Node check, npm ci, .env scaffold, local Postgres (Docker) + auth schema
make dev     # API server on :8080 + Vite dev server on :5199 (proxies /api)
```

That's the whole local stack, auth included — `make db-up` seeds the database and fills the
auth vars into `.env` automatically. Run `make` alone to list all targets.

No Docker? `make setup` skips the database and the app runs guest-only (auth disabled,
state in localStorage only). Sign-in requires a confirmed email; without `RESEND_API_KEY`
the confirmation link is printed to the server log instead of sent. `make db-seed` re-applies the better-auth schema (idempotent);
app tables like `trip_share` and `user_state` are created by the server on boot.
`make start` builds and serves the production bundle on :8080.

## How it works

- **Plan My Trip** — a card wizard (trip style → site conditions → crew) where each card
  contributes a set of lists; the union of tagged gear becomes the trip's packing list.
- **My Trips** — packing checklists grouped by category, with progress tracking, per-trip
  add/remove of items, and editable list layers after creation.
- **Gear & Lists** — manage the gear catalog (name, quantity owned, list membership) and the
  lists themselves (name, icon, description).

Wizard cards are defined in `src/data/seed.ts` (`wizardSteps`) — edit the `tags` array on a card
to change which lists it pulls in.

## Importing a CSV

Open **Gear → Import CSV**, choose a file, review the preview, and confirm the import.
Download a sample from the import dialog or use `public/item-import-template.csv`.

```csv
Item Name,Category,desc,qty,weight,unit,url,price,worn,consumable
Rain jacket,Clothing,"Waterproof, packable",1,10,ounce,https://example.com/jacket,89.95,Worn,
```

- **Item Name** is required. Other columns are optional, and headers may be reordered or use different capitalization.
- **Category** creates or reuses a List by name. An empty category leaves the item unlisted.
- **qty** is the quantity owned/in stock, a whole number of zero or more. Blank means untracked.
- **weight** is the per-item weight, with **unit** in g, kg, oz, lb, or their full singular/plural names. Blank weight means unknown; zero remains zero.
- **desc**, **url**, and **price** become editable item details. URLs must begin with http:// or https://; prices are nonnegative numbers with no currency assumed.
- **worn** and **consumable** accept the column name, yes/no, true/false, or 1/0. Blank means false. Consumables appear in the Consumables tab. Worn items remain on the checklist, with weight reported separately from carried weight.

Matching items are skipped by default using their category and all imported details; existing items are never overwritten. Uncheck **Skip matching items** to import additional copies. Any invalid row blocks the entire import until corrected. Files can contain up to 1,000 items and be up to 1 MB, subject to the library's sync storage limit.

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
