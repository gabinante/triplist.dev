# Trip Styles and card-editor journey

Date: 2026-09-10. Real Chromium/Playwright against the local app, with isolated guest browser contexts and disposable cards/lists in localStorage.

## Findings and changes

| Finding | Change |
| --- | --- |
| Mobile card text was squeezed between the icon and two action buttons; Add card wrapped awkwardly. | Card actions now occupy a separate footer, titles/subtitles wrap, and Add card retains its label on one line. |
| Edit/delete and icon choices lacked accessible names. | Edit/delete name the card; every icon has a name, tooltip, selected state, and a 44px target. |
| Visible Title/Subtitle/Wizard step labels were not linked to controls. | Associated labels and stable IDs support keyboard and assistive-technology use. |
| Card save could not be submitted naturally from a text field. | A guarded form supports Enter, with explicit create/save and cancel actions. |
| Selected list behavior was not explained. | A selected-list count supplements pressed list controls; optional subtitle is identified. |
| Small, dim metadata reduced readability. | Larger subtitle/list text and stronger text colors in the card overview. |

## Verification

All four scenarios passed: light/dark × desktop 1440×1000/mobile 390×844. The matrix passed on the development app at `http://127.0.0.1:5199` and again on the stable production preview at `http://127.0.0.1:5201` after shared theme/navigation/modal changes.

- Open Trip Styles and create a card with title, subtitle, icon, and two lists.
- Verify disabled empty-title submission, icon/list selected states, and no horizontal overflow.
- Edit the card, move it to another wizard step, change its icon, remove a list, and submit with Enter.
- Cancel an edit, then delete the disposable card through its existing confirmation.
- Create a card from the wizard's Other option; verify the step is locked, the saved card becomes selected, and Next is enabled.
- Reload and verify custom-card persistence; no browser page errors in the completed matrix.

Run `node scripts/qa/styles-journey.mjs` with the local app running. Final verification used `TRIPLIST_URL=http://127.0.0.1:5201 node scripts/qa/styles-journey.mjs`. `PLAYWRIGHT_MODULE` can override the shared helper's installed runtime discovery.

Evidence: `/private/tmp/triplist-ux/styles/` contains baseline mobile dark screenshots, `after-*` screenshots for each scenario, and `results.json`. Editor captures include the icon area and lower list/save area. Scope is guest Chromium emulation, not a physical device or signed-in account.
