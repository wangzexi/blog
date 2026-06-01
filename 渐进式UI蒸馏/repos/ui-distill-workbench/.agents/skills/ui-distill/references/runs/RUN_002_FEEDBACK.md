# Distillation Run

## Source
- RN file: `src/App.tsx`
- HTML file: `ui-distill/page.html`

## Refresh Verification
- RN real screenshot command: `xcrun simctl io booted screenshot .tmp/run002-rn-fresh-real.png`
- RN real screenshot file: `.tmp/run002-rn-fresh-real.png`
- HTML real screenshot command: `ui-distill/capture-canvas.sh http://127.0.0.1:4173/page.html .tmp/run002-html-fresh-real.png`
- HTML real screenshot file: `.tmp/run002-html-fresh-real.png`
- Screenshot sizes: both `1179 x 2556`
- Evidence the RN page was initially current: `.tmp/run002-rn-panel-01.png` still contained the complex page's existing magenta-like active step/status region, which matches the current complex exercise, not the older button exercise.
- Evidence the HTML page was current: `capture-canvas.sh` returned `canvas.width=1179` and `canvas.height=2556`; `.tmp/run002-html-panel-01.png` contained the isolated panel mask.

## First Pass
- Existing `page.html` was already a first-pass static translation of the complex RN page.
- For this run, `page.html` was reduced to only `.screen > .panel`.

## Layer Plan
1. panel

## Measurements

### Layer: panel
- RN current node: `styles.panel`
- HTML current node: `.panel`
- Descendants hidden: yes in both files during the attempted measurement
- Target screenshot: `.tmp/run002-rn-panel-01.png`
- Candidate screenshot: `.tmp/run002-html-panel-01.png`
- Result:
  ```json
  {
    "target": { "left": 186, "top": 1605, "right": 987, "bottom": 1637, "width": 802, "height": 33, "area": 1959 },
    "candidate": { "left": 84, "top": 1218, "right": 1094, "bottom": 1337, "width": 1011, "height": 120, "area": 118192 },
    "delta": { "dx": 2.5, "dy": -343.5, "dw": 209, "dh": 87, "area": 116233 },
    "overlap": { "iou": 0.0, "xor": 120151 }
  }
  ```
- Measurement validity: invalid. The RN screenshot did not render the temporary panel mask; it matched a stale complex-page magenta region. This was not used for tuning.
- Tuning applied: none.
- Status: blocked, not frozen.

## Blocker
- After the invalid stale RN measurement, I tried to force freshness by terminating and relaunching `com.company.icompany`.
- The simulator then showed the Company launch screen, not the RN page.
- The dev log `.tmp/example-rn-new-start-dev.log` reports a bundle compile failure:
  ```txt
  Unable to resolve module whatwg-fetch from node_modules/@rn/react-native/Libraries/Network/fetch.js
  ```
- A fresh screenshot after relaunch, `.tmp/run002-rn-panel-after-relaunch.png`, contained no magenta mask. `measure.py` failed with:
  ```txt
  RuntimeError: no soft magenta mask component found
  ```
- Because RN could not be freshly rendered to the temporary panel mask, this run could not legitimately tune `.panel`.

## Final File State
- `src/App.tsx` was restored to the real complex page before final response. It still contains the real active step dot color `#FF00FF`, which is part of the exercise and must be hidden in future mask layers when it is not the target.
- `ui-distill/page.html` is intentionally left in the isolated panel mask state:
  - `.panel` background is `#FF00FF`
  - descendants are removed
  - no geometry tuning was applied
- `ui-distill/DISTILL_GUIDE.md` was not edited in this run.

## Guide Feedback
- The guide should require a documented way to reopen the exact RN exercise route after app termination; `xcrun simctl launch booted com.company.icompany` only reaches the host launch screen.
- The guide should define what to do when the bundler is stale but the app still shows an older cached page: do not relaunch unless the route can be restored.
- The guide should include dependency/bundle health as a hard precondition. In this run, missing `whatwg-fetch` prevented fresh RN rendering after relaunch.
- The guide should say that real source colors close to magenta, such as `#C026D3`, can pass the current soft threshold and create false target masks. For non-target layers, all magenta-like real colors must be hidden or temporarily changed.
