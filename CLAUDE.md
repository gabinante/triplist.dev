# TripList

Layered packing lists for camping/festival trips. Gear lives on tag-based lists; a trip stacks
list layers picked via a card wizard. See README.md for architecture.

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npx tsc --noEmit` — typecheck only

## Architecture notes

- All state is one serializable `{ items, tags, trips }` document in `src/store.tsx`
  (useReducer + localStorage under `triplist-v1`). Keep it that way: multiplayer (shared lists,
  group trip planning) is planned, and a sync backend should be able to replace the persistence
  layer without UI changes.
- Wizard cards/steps live in `src/data/seed.ts`; seed gear is generated in
  `src/data/seed-items.ts` from the original spreadsheet — don't hand-edit the generated file.
- Trip item resolution (`tripItems` in store.tsx): union of items matching the trip's tags,
  plus per-trip `extras`, minus per-trip `excluded`.

## Style preferences (Gabe's — follow these)

- Modern design: dark mode, glassmorphism (`glass` / `glass-hover` / `glass-active` utilities
  in `src/index.css`), moss green + dark grey palette (`moss-*` / `bark-*` theme tokens).
- Animated transitions everywhere: things should fade or slide in and out (framer-motion,
  `AnimatePresence`). No hard reloads or abrupt view swaps — navigation and state changes
  should feel continuous.
- React + TypeScript, attractive component libraries welcome; keep components in the existing
  idiom (Tailwind utility classes, small shared primitives in `src/components/ui.tsx`).
