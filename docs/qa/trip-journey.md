# Trip creation and packing UX audit

Audited locally on 2026-09-10 with Chromium via Playwright, fresh isolated browser contexts, and the real guest-only local API. No signed-in accounts or remote data were used. Source ownership for this journey: `src/views/PlanWizard.tsx`, `src/views/Trips.tsx`.

## Findings and changes

| Finding | Change |
| --- | --- |
| On a 390×844 phone, the first wizard Next button was at y≈2040, below more than two screens of cards. | Sticky Back/Next/Create footer stays visible above the mobile navigation; each step returns to its question. |
| Wizard progress was only unlabeled dots; card selection and name/date fields lacked programmatic labels. | Visible announced step count, pressed card state, labeled fields, required name guard, and review/back retention. |
| Trip cards and checklist rows were clickable divs, unreachable through standard keyboard controls. | Native trip-open buttons and checkbox inputs; Space toggles packing, Enter opens a trip. |
| Small, dim remove icons were difficult to find and tap. | Named 44px removal buttons and an Undo notice; add-item flow restores excluded items. |
| Trip name and date could not be corrected after creation. | Edit trip modal with labeled name/date fields, validation, cancel and save. |
| Long trip names were truncated; tags were constrained beneath the name next to the progress ring. | Wrapping trip names and full-width compact tags. |
| Large packing lists had no search or status filtering. | Search and All / To pack / Packed filters, counts, meaningful empty state, and Clear filters. |
| Reset immediately erased all packing progress. | Confirmation with Keep progress; Reset disabled when there is no packed progress. |
| Add-item form compressed name/type into narrow phone columns, used raw tag IDs, and gave no add confirmation. | Stacked fields on mobile, readable list names, item-added status and explicit Done action. |

Shared theme, modal, static chip, and navigation changes were supplied by the root agent and exercised by the same runs.

## Executed checks

`QA_BASE_URL=http://127.0.0.1:5201 node scripts/qa/trip-journey.mjs` passed again against the stable production preview for **1440×1000 dark**, **1440×1000 light**, **390×844 dark**, and **390×844 light**. Mobile cases used touch/mobile browser emulation. Each case passed:

1. First wizard screen and required-choice validation; Next visible without scrolling.
2. Trip style → accommodations → conditional meal-prep → crew → review.
3. Back/forward preserves selections and name/date values.
4. Create trip and inspect packing detail.
5. Edit long name and date; add/remove a trip list.
6. Keyboard Space packs an item and a meal ingredient; status filters and search agree with state.
7. Filter-empty state and Clear filters.
8. Remove, Undo, remove again and restore through Add item.
9. Create a new disposable item from inside the add-item modal and verify it enters the trip.
10. Pack all, cancel reset, confirm reset.
11. Reload and verify local trip persistence, then open from the grid with Enter; delete the disposable trip and verify empty state.
12. No horizontal page overflow at each screenshot state and no browser page errors.

All 64 after screenshots and machine-readable results are in `/private/tmp/triplist-ux/trips`. Baseline: `before-mobile-wizard.png`. Useful comparisons: `mobile-light-01-trip-style.png`, `mobile-light-12-create-item.png`, `mobile-light-14-trip-detail-after.png`, `desktop-dark-10-checklist-filtered.png`, `desktop-light-05-review.png`.

## Re-run

Start Vite and the guest API, then run `node scripts/qa/trip-journey.mjs`. Override URL with `QA_BASE_URL`; screenshots with `QA_OUTPUT_DIR`; individual scenario with `QA_CASE=mobile-light`. The shared Playwright loader can use `PLAYWRIGHT_MODULE` when needed. On this macOS host Chromium launch needs sandbox escalation. Browser contexts are disposable; the suite does not touch the user's normal browser data.

Packing-plan/container details are covered by the separate container journey. Real email delivery, remote sharing, auth and account persistence are outside this guest journey.
