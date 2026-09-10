# Create and edit lists

Audited with real Playwright against a stable local production preview in isolated guest browser contexts. All six scenarios passed: light and dark at 1440 × 1000, 390 × 844, and 320 × 844. Mobile contexts emulate touch and mobile viewport behavior.

## Findings and changes

| Finding | Impact | Resolution |
| --- | --- | --- |
| The Lists page measured 677px wide on a 390px phone in both themes. | Actions were off screen; the enlarged layout viewport could prevent tapping bottom navigation. | Explicit single-column mobile grid, wrapping titles and descriptions, and a separate action row. Final width is bounded by the configured viewport, including 320px. |
| “Edit list” only edited name, description, icon, and automatic inclusion. | Users could not inspect or change a list’s contents from Lists. | Add an “Edit items” action and openable list titles. The content editor supports search, current/all item views, selection, cancellation, and saved membership changes. |
| List descriptions were truncated and titles competed with icon actions. | Users could not distinguish similar lists on mobile. | Readable wrapping descriptions and stable action placement. |
| List actions and icon choices lacked accessible names and state. | Keyboard and assistive navigation could not identify controls. | Named controls, 44px targets, associated form labels, and pressed state for icon and automatic-list choices. |
| Icon selection made metadata forms long on phones. | Save/cancel controls could fall below the viewport. | Sticky action footer with the shared scrollable, labeled dialog and sticky header. |
| No list search or search recovery existed. | Growing list collections required long scrolling. | Name/description search, a useful empty state, and Clear search. |

## Validation

`TRIPLIST_QA_URL=http://127.0.0.1:5201 node scripts/qa/list-journey.mjs`

The script creates a list with a long title and description, chooses an icon, toggles automatic inclusion, edits metadata, adds two existing items, cancels a removal, saves a removal, verifies prepared print content, and deletes the list. Assertions confirm other list memberships and all item data survive removal and deletion. It also searches, clears empty results, checks horizontal overflow against the configured viewport width, and taps Trip Styles from Lists on mobile. No browser errors occurred.

Print verification intercepts `window.print` and checks the prepared print sheet; it does not open the operating system print dialog. Sharing with another account was outside the guest-only run.

Screenshots and results: `/private/tmp/triplist-ux/lists`. Original screenshots are `before-*`; final screenshots are `after-*`; the machine-readable matrix is `results.json`. The reusable script resolves installed Playwright through `scripts/qa/browser.mjs` without changing app dependencies.
