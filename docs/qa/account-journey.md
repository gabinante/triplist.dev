# Account, preferences, friends and sharing UX audit

Audited locally on 2026-09-10 at the stable production preview, `http://127.0.0.1:5201`, using Playwright Chromium at 1440×1000 and 390×844 in light and dark modes. Mobile contexts used touch/mobile emulation.

## Scope and fixture boundary

The Friends screen in a guest-only session was tested against the real local API. The local server has no configured authentication. Every subsequent `/api/**` request in the signed-in portion was intercepted and fulfilled by Playwright with fictional `example.invalid` users. No real accounts, profile changes, email, friend requests or shares were sent. Successful delivery, real authentication, and cross-device persistence are not established by these fixtures.

## Findings and changes

| Finding | Change |
| --- | --- |
| Friends offered a sign-in button even when local auth was unavailable. | Guest screen now explains unavailable sharing while keeping trip/gear work available. |
| Signed-in avatar plus account actions crowded the mobile header. | Compact, labeled 44px Preferences and Sign out controls; identity remains in desktop sidebar. |
| Preferences lacked a named dialog, focus containment/return, Escape dismissal and field associations. | Shared dialog hook, named dialog, explicit labels/autocomplete, and keyboard validation. |
| The Preferences close button overlapped scrolling fields, and its full-screen background could stop before long content. | Sticky title/close header with an opaque theme-aware background for the entire scrolling overlay. |
| Profile save feedback disappeared immediately after auth session refresh. | Initialize fields/status when opening or changing accounts, preserving feedback and in-progress edits through session refresh. |
| Notification toggle looked like a long pill and failed saves could silently leave the wrong apparent state. | Accessible labeled switch, explicit status, rollback on returned API error, and disabled state while saving. |
| Password request errors could leave the form busy. | Error handling with announced status and guaranteed busy-state cleanup. |
| Friend invite input and long addresses crowded phone layouts. | Stacked phone invite form, wrapping pending addresses, responsive request actions, named 44px remove/cancel controls. |
| Sharing form labels and completion/error messages were not accessible. | Associated email/message fields, bounded friend chips, and status/alert semantics. |

## Executed checks

`TRIPLIST_URL=http://127.0.0.1:5201 node scripts/qa/account-journey.mjs` passed all four theme/viewport combinations, producing **40 screenshots** with no browser page errors or horizontal page/dialog overflow. Overflow checks compare content width with the configured viewport width, including mobile emulation.

Each scenario checked:

- Live guest-only Friends screen and absence of an unusable Sign in action.
- Fixture signed-in header and accessible Preferences entry.
- Profile form values, simulated name save, and retained save feedback after session refresh.
- Simulated password error feedback and form recovery.
- Simulated notification failure, error message and rollback to the prior switch state.
- Preferences keyboard focus wrap, Escape close, and focus return to its opener.
- Incoming, outgoing and accepted friends, including long email addresses.
- Simulated friend-invite error.
- Trip-sharing form with a long title, selecting a fictional friend, optional message entry, and simulated success. All requests were fulfilled inside Playwright.

Screenshots and intercepted-request summaries: `/private/tmp/triplist-ux/account/results.json` and adjacent PNG files. Useful review images: `mobile-light-03-fixture-preferences-profile.png`, `mobile-light-05-fixture-notification-error.png`, `mobile-light-06-fixture-friends.png`, `mobile-light-09-fixture-share-form.png`, `desktop-dark-03-fixture-preferences-profile.png`.

Re-run with the command above; `QA_CASE=mobile-light` selects one scenario, `QA_OUTPUT_DIR` changes the output root, and `PLAYWRIGHT_MODULE` can supply an installed runtime. This host requires sandbox escalation to launch Chromium.
