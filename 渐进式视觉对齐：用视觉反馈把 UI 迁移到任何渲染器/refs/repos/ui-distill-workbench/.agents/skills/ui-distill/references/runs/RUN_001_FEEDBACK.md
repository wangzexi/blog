# Distillation Run 001 Feedback

## Source

- RN file: `src/App.tsx`
- HTML file: `ui-distill/page.html`
- Guide: `ui-distill/DISTILL_GUIDE.md`

## Outcome

Blocked before a valid layer could be frozen.

The sub-agent did not modify `ui-distill/page.html` beyond the existing first-pass translation and did not create this feedback file itself. This file records the parent review of that failed manual test.

## What Worked

- The agent read `DISTILL_GUIDE.md` and understood that direct translation is not enough.
- It identified a real source-page issue: `styles.stepDotActive` uses `#FF00FF`, which can collide with the mask color if not hidden during other layer measurements.
- It started the RN dev server.
- It confirmed a booted simulator exists.
- It confirmed RN screenshots can be captured:

```bash
xcrun simctl io booted screenshot .tmp/rn-current-check.png
```

## Blocker

The agent suspected that the simulator was still showing the old simple button page instead of the current complex `App.tsx` exercise.

It then tried to read `/tmp/example-rn-new-start-dev.log`, but its permissions rejected reading `/tmp`. The run stopped without completing a valid outside-in mask measurement.

## Layers Completed

None.

## Layers Attempted

### Layer: refresh verification

- Descendants hidden: no.
- RN mask target: none.
- HTML mask target: none.
- Measurement output: none.
- Tuning changes made: none.
- Status: blocked before the first mask layer.

## Guide Issues Found

- The guide did not explicitly require proving that the simulator is rendering the current `App.tsx` before mask measurement.
- The guide did not provide the exact RN screenshot command.
- The guide did not require screenshot file paths and dimensions in the run log.
- The guide did not say to keep logs inside the project instead of `/tmp`.
- The guide did not reserve `#FF00FF` exclusively for masks or explain what to do when the real page already contains that color.
- The guide did not define what to do when RN output is stale after editing `App.tsx`.

## Required Guide Changes

- Add hard preconditions for current-page verification.
- Add `xcrun simctl io booted screenshot` as the standard RN capture command.
- Require a "Refresh Verification" section in every run log.
- Require project-local logs and screenshots.
- Treat stale RN output as a real blocker, not a reason to keep tuning HTML.

## Status Check Addendum

After updating the guide, a second agent run was started but stopped at user request before finishing the first mask layer.

### Refresh Verification

- RN screenshot file: `.tmp/rn-current-check.png`
- HTML screenshot file observed: `.tmp/html-canvas-screenshot.png`
- Screenshot sizes:
  ```txt
  .tmp/rn-current-check.png: 1179 x 2556
  .tmp/html-canvas-screenshot.png: 1179 x 2556
  ```
- Evidence the RN page is current: the agent reported that the RN screenshot shows the complex page with `蒸馏任务台` and `RN 到 HTML 对齐`.
- Issue found: the observed HTML screenshot was stale from the old button page until the HTML capture chain was refreshed.

### Current Layer At Stop

- Layer: preparing first non-screen mask layer, `panel`.
- Descendants hidden: not completed.
- RN mask target: intended `styles.panel`.
- HTML mask target: intended `.panel`.
- Measurement output: none yet.
- Tuning changes made: none.
- Status: stopped before measurement, per user request.

### Additional Guide Ambiguities

- The guide should distinguish "RN screenshot is current" from "HTML screenshot is current"; both need independent freshness checks.
- The guide should require recapturing HTML immediately before every measurement instead of reusing `.tmp/html-canvas-screenshot.png`.
- The guide should define a stop protocol for interrupted runs: restore `App.tsx`, record the current layer, and do not leave masked state behind.
