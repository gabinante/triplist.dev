# Container and packing-plan journey

Date: 2026-09-10. Real Chromium/Playwright against the local app, with a fresh guest browser context for each scenario. Only disposable localStorage fixtures were created or removed.

## Findings and changes

| Finding | Before | Change |
| --- | --- | --- |
| Mobile rename overflow | At 390px viewport width, the document expanded to 447px while renaming. | Flexible, labeled input with explicit 44px save/cancel controls; long names wrap. |
| Small, faint container actions | Rename/remove were 22×22px with low-contrast icons. | 44×44px controls, clearer color, and names including the target container. |
| Cramped mobile headings | Long container names competed with weight, status, and actions in a single row. | Full-width wrapping title with weight/status/actions below. |
| Touch scrolling conflicted with drag | Every item row used `touch-none`. | Only the drag handle intercepts touch; item text supports native vertical scrolling. |
| Ambiguous assignment and keyboard behavior | Clickable draggable divs lacked ordinary keyboard activation and descriptive actions. | Item buttons name their destination or unsort action, support Enter, and announce moves. |
| Create/rename depended on Enter or blur | No explicit save/cancel controls; blur could commit unintentionally. | Labeled forms, visible actions, empty-name prevention, and Escape cancellation. |
| Accidental deletion could discard all assignments | Trash immediately removed a container. | Confirmation explains that gear returns to Not sorted yet and remains on the checklist. |

## Verification

All four scenarios passed: light/dark × desktop 1440×1000/mobile 390×844. The completed matrix passed on the Vite development app at `http://127.0.0.1:5199` and again on the stable production preview at `http://127.0.0.1:5201` after the shared theme/navigation/modal changes.

- Create suggested and custom containers; reject whitespace; cancel creation.
- Select destination, tap to assign, move between containers, and unsort.
- Enter-key assignment, real mouse dragging on desktop, and native touch scrolling over item text on mobile.
- Rename long names, save, cancel with Escape, and verify fit.
- Cancel removal, confirm removal, retain gear, and reload to verify persistence.
- Check horizontal overflow at every captured stage and assert 44px rename/remove targets.
- No browser page errors in the completed matrix.

Run `node scripts/qa/container-journey.mjs` with the local app running. Final verification used `TRIPLIST_URL=http://127.0.0.1:5201 node scripts/qa/container-journey.mjs`. The shared browser helper resolves an installed Playwright runtime; `PLAYWRIGHT_MODULE` can override it.

Evidence: `/private/tmp/triplist-ux/containers/` contains `before-*`, `after-*`, and `results.json`. Before screenshots cover dark desktop/mobile; both themes are covered after. Full-page captures include the complete packing plan. The fixed mobile navigation appears at the first viewport's bottom within a longer full-page image; it remains at the viewport bottom during normal scrolling.

Scope: Chromium mobile emulation covers viewport/touch behavior, not a physical iOS/Android browser or a signed-in account.
