# Gear, weights, consumables, and meals

Audited locally with Playwright in isolated guest browser contexts at 1440 × 1000 and 390 × 844. All four final scenarios passed against the stable production preview at `http://127.0.0.1:5201`: light and dark on desktop and mobile. The original app provided only dark mode.

## Findings and changes

| Finding | Impact | Resolution |
| --- | --- | --- |
| Edit and delete were hidden until hover: 134 hidden actions on the seeded Gear page. | Touch users could not discover how to edit a weight; keyboard focus did not reveal actions. | Persistent, named, 44px action buttons. |
| Fixed rows squeezed names, stock controls, and metadata on phones. | Narrow names wrapped awkwardly, tiny stock buttons were difficult to tap, and list membership disappeared. | Wrapping rows; a separate stock row on mobile; readable weight, owned quantity, and list badges in both sizes. |
| Saving a weight of zero silently removed it. | Zero and unknown values were indistinguishable. | Preserve zero, support decimals and all four units, make blank mean unknown, and reject negative values. |
| Stock accepted negative and fractional values. | Invalid inventory counts could be saved. | Whole-number validation and inline explanation. |
| Unit selection semantics and blank numeric values were unexplained. | Users could mistake unit selection for conversion. | Explicit per-item weight label, blank-state guidance, and explanation that selecting a unit keeps the number. |
| “Add meal” opened an “Add consumable” modal. | The creation flow contradicted the selected item type. | Correct creation titles and action labels. |
| Inputs and icon controls lacked accessible names. | Screen reader and automated navigation were unreliable. | Associated labels, named edit/delete/stock/ingredient controls, semantic groups and list rows. |
| Ingredient actions had tiny targets and duplicate names differed only by case. | Ingredient editing was awkward on mobile. | 44px targets, overflow-safe text, keyboard entry, duplicate feedback, and case-insensitive duplicate prevention. |
| Large list selectors hid form actions below the fold. | Saving on mobile required hunting through a long modal. | Searchable list membership and sticky form actions. |
| Empty search offered no recovery action. | A combined search and list filter was hard to reset. | Clear filters button and distinct first-use empty state. |
| List filter chips filled most of the mobile viewport. | Users had to scroll before reaching gear. | Compact native list selector on mobile, with visible chips retained on desktop. |

## Reproduction

Run `node scripts/qa/gear-journey.mjs` with the local app at `http://127.0.0.1:5199` (override with `TRIPLIST_QA_URL`). It resolves installed Playwright through the shared QA helper without modifying app dependencies. Chromium may require permission to run outside the macOS sandbox.

Checks cover item creation and list membership; search and list filters; editing, cancellation and deletion; blank, zero, decimal and invalid weights; g/kg/oz/lb selection; stock validation and increment/decrement bounds; meal ingredients, duplicate feedback and removal; 44px action visibility; focus restoration; and horizontal overflow. Saved state is checked after each mutation. No account or external message is used.

The final run used `TRIPLIST_QA_URL=http://127.0.0.1:5201 node scripts/qa/gear-journey.mjs`. All checks passed with no browser errors. Twenty-four final viewport screenshots were captured and representative desktop/mobile forms and pages were visually reviewed in both themes. TypeScript also passed with `npx tsc -b`.

Screenshots and machine-readable results are saved in `/private/tmp/triplist-ux/gear`. Original screenshots are prefixed `before-`; final screenshots are prefixed `after-`.

No exercise editor or upload button exists in this repository. The relevant item and meal dialogs were inspected instead.
