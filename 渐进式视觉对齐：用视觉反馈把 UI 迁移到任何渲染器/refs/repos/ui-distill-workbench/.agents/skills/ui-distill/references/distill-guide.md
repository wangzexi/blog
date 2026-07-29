# RN to HTML Distillation Guide

This guide is the working instruction for distilling `../rn-new/src/App.tsx` into `pages/app.html`.

The goal is not a visually similar rewrite. The goal is an iterative pixel-alignment workflow.

Direct translation usually only looks roughly similar. Distillation starts after direct translation, when each layer is isolated, painted magenta, measured, and micro-adjusted until the screenshot pixels match as closely as the renderer allows.

The core files are:

- `../rn-new/src/App.tsx`: source RN page.
- `pages/app.html`: distilled HTML target corresponding to `../rn-new/src/App.tsx`.

Support files:

- `index.html`: previewer only; it is an iframe shell for humans.
- `.agents/skills/ui-distill/scripts/capture-html.mjs`: captures `pages/app.html` at `1179 x 2556` through system Chrome.
- `scripts/measure.py`: compares magenta masks between screenshots.
- `dev-server.mjs`: live reload static server.

## Hard Preconditions

Before claiming that any layer was measured, verify the whole capture chain.

1. The iOS simulator must be booted.
2. The simulator must show the current `../rn-new/src/App.tsx`, not a stale bundle.
3. The RN bundle must be healthy after the latest `App.tsx` edit.
4. The RN screenshot and HTML screenshot must both be `1179 x 2556`.
5. The current mask screenshot must contain exactly the intended magenta layer.
6. Each measurement must name the two screenshot files that were compared.
7. Both screenshots must be freshly captured for the current layer. Do not reuse an old `.tmp/html-canvas-screenshot.png` from a previous page state.

Use project-local logs and screenshots. Do not depend on `/tmp` when writing feedback, because delegated agents may not have permission to read it. Prefer `.tmp/...` for temporary captures and `RUN_XXX_FEEDBACK.md` for run notes.

If the RN screenshot shows an old page after `App.tsx` changes, stop the layer loop and document the refresh blocker. Do not continue measuring against stale RN output.

Freshness must be checked independently for RN and HTML. RN can be current while HTML is stale, and HTML can be current while the simulator is stale. A valid run must prove both sides before measuring.

Do not terminate or relaunch the host app unless the exact command or deep link for reopening the current RN exercise route is known. Launching only the host bundle, for example `xcrun simctl launch booted <host-app-id>`, may land on the host splash/home screen instead of the target RN page. If the route cannot be restored, stop and document the blocker.

Bundle health is a hard precondition. If a mask edit to `App.tsx` does not appear in the simulator screenshot, check the project-local dev-server output or known dev-server log before retrying measurements. Dependency resolution errors, such as a missing module, invalidate the run until fixed.

## Fixed Canvas

Always implement `pages/app.html` as a fixed iPhone 16 screenshot canvas:

```txt
width: 1179px
height: 2556px
RN dp -> CSS px: multiply by 3
```

`pages/app.html` should have no preview shell, no scaling, and no dev-only outer frame. `index.html` is the only file that handles scaling for human inspection.

## Translation Rules

Translate RN styles directly:

- `View` -> `div`
- `Text` -> text element, usually `span` or `div`
- `TouchableOpacity` -> `button` when interactive semantics matter, otherwise `div`
- `flexDirection: 'row'` -> `display: flex; flex-direction: row`
- default RN flex direction is column
- `alignItems`, `justifyContent`, `padding`, `margin`, `borderRadius`, `backgroundColor`, `color`, `fontSize`, `fontWeight`, `lineHeight` map directly after multiplying numeric values by 3

Use fixed dimensions where RN uses fixed dimensions. Use flex only where RN uses flex.

Do not invent unrelated structure. Inline one-off elements when it keeps `pages/app.html` easier to inspect.

## Agent Contract

When an agent is asked to distill a page, it must not treat direct conversion as the final answer. Direct conversion is only the draft.

The main work is pixel micro-adjustment:

- isolate one layer;
- paint it magenta;
- measure screenshot error;
- adjust dimensions, position, radius, padding, font metrics, or transform;
- repeat until the measured error stops improving;
- then freeze the layer and move inward.

The required output process is:

1. Create a faithful first-pass `pages/app.html` from `App.tsx`.
2. Define the RN host-node tree from outside to inside.
3. Start with the outermost RN node only. Comment out or remove all descendants on both RN and HTML sides.
4. Turn the current RN node and the matching HTML node magenta.
5. Capture both sides and run `scripts/measure.py`.
6. Fix only the current node's geometry.
7. Freeze that node's geometry.
8. Restore the current node's direct children and move one layer inward.
9. Repeat until all shape/layout layers are aligned.
10. Align text boxes.
11. Align text glyphs.
12. Restore real colors only after all required layers are aligned.

If the agent cannot run the RN screenshot, it must still prepare `pages/app.html` so the parent agent can run the mask loop. It should not claim pixel alignment without mask measurement.

If the agent can run RN screenshots, it must run at least the outermost non-screen layer before reporting success. A run that only creates a direct translation is a failed manual test, even if the visual page looks close.

## Execution Granularity

Do not ask one agent to finish a complex page end to end unless the page is tiny.

Prefer small runs with an explicit layer target:

```txt
Run target: panel only
Run target: hero card only
Run target: first metric card only
Run target: CTA button text box only
```

Each run should freeze at least one layer or produce a concrete blocker. After a layer is frozen, start a new run for the next layer.

This makes feedback reviewable. A long run that gets stuck before freezing any layer is useful only as guide feedback, not as successful distillation.

For environment validation runs, stop before editing geometry. The output should be a clear freshness/bundle-health report, not partial tuning.

## Core Principle: Crop The Tree

After the first-pass translation, do not compare the full page at once.

For each layer, both renderers must be reduced to the same current node:

```txt
RN:   render current node, hide/comment all descendants
HTML: keep matching node, hide/comment all descendants
```

Then make the current node `#FF00FF` on both sides and measure only that node.

This is mandatory because child content creates noisy mask pixels. If children remain visible while aligning the parent, the measured bbox may describe the child union instead of the parent.

Only after the current node is aligned may its direct children be restored. Then each child becomes the next current node, still with its own descendants hidden.

The process is depth-first or breadth-first, but it must always be outside-in:

```txt
screen
  panel
    header
      title group
        title text box
        title glyph
    hero card
      progress track
      progress fill
    metrics row
      metric card
    steps container
      step row
        dot
        text box
        glyph
    button
      button text box
      button glyph
```

Do not skip from `panel` directly to text glyphs.

## Stop Conditions

For shape/layout layers, keep tuning until one of these is true:

- ideal: `dx=0`, `dy=0`, `dw=0`, `dh=0`;
- acceptable when renderer quantization prevents exact zero: all bbox deltas are within `1px` and no neighboring adjustment improves `iou` or lowers `xor`;
- blocked: the current layer is affected by an unhidden child or by a parent that was not frozen.

For glyph layers, use two stages:

1. Bbox stage: tune until `dx/dy/dw/dh` are zero or within `1px`.
2. Pixel stage: tune `iou`, `xor`, and `area`.

For glyph pixel tuning, prefer the candidate with the highest `iou`. If `iou` ties, prefer lower `xor`. If both tie, prefer lower absolute `area` delta.

Do not make arbitrary visual guesses after a measurement gets worse. Revert to the best measured parameters and try a different knob.

Record the best measured parameters when a layer is frozen.

## Micro-Adjustment Knobs

Shape/layout knobs:

- `width`, `height`
- `padding`, `margin`
- `border-radius`
- `left/top` or `transform: translate(...)`
- flex alignment and gap/margin
- line height for text boxes

Glyph knobs:

- `font-family`
- `font-size`
- `font-weight`
- `line-height`
- `letter-spacing`
- `transform: translate(...)`
- `-webkit-font-smoothing`

Apply one knob at a time and rerun measurement. Keep the best measured result, not the most visually plausible result.

## Roles

There are three roles in this workflow:

1. Problem setter
   - Edits `../rn-new/src/App.tsx`.
   - Creates a static RN page that is complex enough to expose layout and typography issues.
   - Does not optimize for HTML convenience.

2. Distiller
   - Reads `../rn-new/src/App.tsx` and this guide.
   - Edits only `pages/app.html`.
   - Produces a first-pass HTML page, then follows the magenta mask layer loop.

3. Reviewer
   - Captures RN and HTML screenshots.
   - Runs `scripts/measure.py`.
   - Finds where the distiller skipped layers or guessed styles.
   - Updates this guide with the new failure mode.

## Distiller Prompt Template

Use this when delegating `pages/app.html` to another agent:

```txt
Read `.agents/skills/ui-distill/references/distill-guide.md` and `../rn-new/src/App.tsx`.

Your write scope is only `pages/app.html`.

Implement a first-pass static HTML distillation of the current RN page.
Use a fixed `1179 x 2556` canvas.
Map RN dp to CSS px by multiplying by 3.
Do not add preview shell logic.
Do not edit RN source, scripts, or docs.

After the first-pass draft, list the outside-in magenta mask layers you would run next.
Do not claim pixel alignment unless measurement output exists.
```

If the agent is allowed to run the full loop, extend the prompt:

```txt
For each layer, reduce both RN and HTML to the same current node by hiding/commenting descendants. Temporarily use #FF00FF on the current RN node and current HTML node, capture both screenshots, run scripts/measure.py, and tune only that layer until bbox deltas are close to zero. Freeze the layer, restore only its direct children, and continue inward. Restore real colors after all required layers are frozen.
```

## Layer Selection

Always work from low frequency to high frequency. A good layer list for a card-style page is:

1. Screen background.
2. Outer panel/card.
3. Header row.
4. Hero card.
5. Metric row and metric cards.
6. Steps container.
7. Individual step rows.
8. Dots, badges, bars, and buttons.
9. Text layout boxes.
10. Text glyphs.

Do not begin with text. Text is the last major layer because font rasterization has high renderer-specific noise.

For shape layers, descendants must be hidden. For example:

- Aligning the outer panel: render only the panel rectangle.
- Aligning the hero card: render only the hero card rectangle inside the already aligned panel.
- Aligning the progress track: render only the track rectangle inside the already aligned hero card.
- Aligning a text layout box: render the text box background but not the glyph as a separate color.
- Aligning a glyph: remove the text background and render only the glyph in magenta.

## Text Rules

Use this baseline font stack:

```css
font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
```

For Chinese RN text, Chrome and iOS/RN rasterization will not be perfectly identical. Align in layers:

1. Text layout box: temporarily set text background to `#FF00FF` and text color to `#FF00FF`.
2. Text glyph: remove text background and keep only text color `#FF00FF`.
3. Real visual: restore actual text color.

Useful glyph tuning knobs:

```css
-webkit-font-smoothing: antialiased;
font-size: /* small decimal adjustments */;
font-weight: /* may be quantized by browser */;
letter-spacing: /* small px adjustments */;
transform: translate(...);
```

Do not optimize glyph pixels before the text layout box is aligned.

## Magenta Mask Workflow

Use fixed magenta:

```txt
#FF00FF
```

`#FF00FF` is reserved for distillation masks. Avoid using it as a real design color in new exercises. If the source page already contains real `#FF00FF`, that element must be hidden when it is not the current layer, otherwise it will pollute the mask measurement.

The soft magenta threshold can also match nearby purples, for example `#C026D3`. During mask measurement, all non-target magenta-like or purple elements must be hidden, removed, or temporarily recolored outside the mask range. If the target screenshot has more than one magenta-like component, the layer is invalid.

Preferred layer order:

1. Outer container or large card background.
2. Important block/card background.
3. Button or control background.
4. Text background box.
5. Text glyph.
6. Restore real visual colors.

For each layer:

1. Hide/comment descendants of the current node in `App.tsx`.
2. Hide/comment descendants of the matching node in `pages/app.html`.
3. Make the current RN node magenta in `App.tsx`.
4. Make the current HTML node magenta in `pages/app.html`.
5. Capture iOS simulator.
6. Capture HTML.
7. Run `scripts/measure.py`.
8. Use `dx / dy / dw / dh` first.
9. Use `iou / xor / area` only after bbox is close.
10. Freeze the layer, restore its direct children, and pick the next child layer.

Before running `scripts/measure.py`, inspect or script-check that the only visible magenta component is the current target. If multiple magenta components are visible, the layer is invalid; hide the extra nodes and recapture.

Use the same mask target on both sides. Examples:

- Outer panel: panel background is `#FF00FF`, all children can remain hidden or unchanged.
- Button box: button background is `#FF00FF`, text should also be `#FF00FF` or hidden so it does not cut holes.
- Text layout box: text background is `#FF00FF`, text color is also `#FF00FF`.
- Text glyph: text background is removed, text color is `#FF00FF`.

The mask color is fixed, but screenshot pixels are not exact. Use soft threshold measurement, not exact RGB matching.

## Capture Commands

Capture RN from the booted simulator:

```bash
xcrun simctl io booted screenshot .tmp/rn-<layer>.png
```

Capture HTML:

```bash
node .agents/skills/ui-distill/scripts/capture-html.mjs --page pages/app.html --width 1179 --height 2556 --output .tmp/html-panel.png
```

The HTML command writes `.tmp/html-canvas-screenshot.png`. Copy or rename it when recording multiple layers, for example `.tmp/html-panel.png`, so later measurements remain reproducible.

Measure:

```bash
python3 .agents/skills/ui-distill/scripts/measure.py .tmp/rn-<layer>.png .tmp/html-<layer>.png
```

If `scripts/measure.py` reports no magenta component, do not guess. Check these in order:

1. Did RN refresh to the current masked `App.tsx`?
2. Is the current layer really painted `#FF00FF`?
3. Are descendants and unrelated real-magenta nodes hidden?
4. Did HTML capture the real `pages/app.html`, not `index.html`?
5. Are both screenshots `1179 x 2556`?

Only after these checks should the run be marked blocked.

If `scripts/measure.py` reports a huge bbox, `iou=0`, or a bbox located far away from the intended layer, treat it as mask pollution or stale screenshot until proven otherwise. Do not tune geometry from an invalid measurement.

## Reading Measurement Output

Use geometry first:

```json
{
  "dx": 0,
  "dy": 0,
  "dw": 0,
  "dh": 0
}
```

Meaning:

- `dx`: candidate center is right of target if positive.
- `dy`: candidate center is below target if positive.
- `dw`: candidate width is larger if positive.
- `dh`: candidate height is larger if positive.

Only after bbox is close, optimize:

- `iou`: higher is better.
- `xor`: lower is better.
- `area`: candidate mask area minus target mask area.

For font glyphs, bbox can reach zero while IoU is still below 1.0. That means the glyph envelope is aligned but internal rasterization differs.

Pixel identity may be impossible across RN/iOS and Chrome because font rasterization and antialiasing differ. Still, the workflow should push toward pixel identity by maximizing measured overlap, not by relying on visual inspection.

## Review Checklist

When reviewing a distilled `pages/app.html`, check:

- It uses `1179 x 2556` fixed canvas.
- It does not contain preview shell logic.
- It maps RN dp values by multiplying by 3.
- It keeps RN ownership boundaries visible in class names or structure.
- It does not add decorative styles absent from `App.tsx`.
- It does not hide uncertainty by making arbitrary font tweaks before mask measurement.
- It records which layer is currently masked.
- It restores real colors after mask alignment.
- It reports measurement output for the layer it claims is aligned.
- It keeps the best measured parameters rather than the last attempted parameters.

## Required Run Log

Every full distillation run must create a feedback log next to `pages/app.html`.

Use this shape:

```md
# Distillation Run

## Source
- RN file: `../rn-new/src/App.tsx`
- HTML file: `pages/app.html`

## First Pass
- Summary of translated node tree.

## Layer Plan
1. screen
2. panel
3. ...

## Measurements

### Layer: panel
- RN current node: `styles.panel`
- HTML current node: `.panel`
- Descendants hidden: yes
- Target screenshot: `.tmp/...`
- Candidate screenshot: `.tmp/...`
- Result:
  ```json
  {"dx":0,"dy":0,"dw":0,"dh":0}
  ```
- Tuning applied:
  - `width: ...`
- Status: frozen

## Guide Feedback
- What was ambiguous?
- What instruction was missing?
- What step was slow or hard to execute?
```

If a layer is skipped, the log must say why. A run without a layer log is not a successful manual execution.

## Stop Protocol

When a run is interrupted or blocked:

1. Restore `../rn-new/src/App.tsx` to the real source page unless the user explicitly asks to leave RN masked.
2. Leave `pages/app.html` in either:
   - the last frozen real state, or
   - the current masked state only if the feedback log says exactly which layer is masked.
3. Write the current layer and blocker to the run log.
4. Do not claim any layer was frozen unless it has valid measurement output.

If a run is interrupted, stop at the current layer boundary:

1. Restore `../rn-new/src/App.tsx` to the real visual state.
2. Do not leave `pages/app.html` in an undocumented mask state.
3. Record the current layer, whether descendants were hidden, and whether any measurement had been taken.
4. Record which screenshots are fresh and which are stale.
5. Do not claim the layer is frozen unless measurement output exists.

The run log must also contain a "Refresh Verification" section:

```md
## Refresh Verification
- RN screenshot command:
- RN screenshot file:
- HTML screenshot command:
- HTML screenshot file:
- Screenshot sizes:
- Evidence the RN page is current:
```

The evidence can be a visible unique text value, a unique temporary mask layer, or a successful magenta measurement for the current layer. If this section is missing, the manual did not guide the run well enough.

## Current Exercise Log

Exercise 1: simple centered button.

- Button box bbox reached `dx=0`, `dy=0`, `dw=0`, `dh=0`.
- Text layout box bbox reached `dx=0`, `dy=0`, `dw=0`, `dh=0`.
- Text glyph bbox reached zero geometry error.
- Glyph IoU improved to about `0.875`, but did not reach pixel identity due to Chrome vs iOS/RN rasterization.

Exercise 2: dashboard card page.

- `App.tsx` now contains a nested card page with header, badge, hero card, progress bar, metric cards, step rows, and CTA button.
- A sub-agent produced a visually close first-pass `pages/app.html`.
- Review finding: the sub-agent did direct translation but did not execute the required outside-in magenta mask loop. The guide therefore now explicitly says direct conversion is only the draft and must be followed by layer measurement.

Exercise 2 / RUN_001 manual test:

- The sub-agent correctly identified that a real `#FF00FF` active dot can pollute mask detection.
- It confirmed the booted simulator could be screenshot with `xcrun simctl io booted screenshot`.
- It did not complete a layer measurement because it suspected the simulator was still showing an old button page and then attempted to inspect `/tmp` logs, which was rejected by its permissions.
- Guide update: preconditions now require RN refresh verification, project-local logs, explicit screenshot paths, and a hard stop when RN output is stale.

## Convenience Commands

Start preview server with project-local logging:

```bash
npm run dev > .tmp/html-dev-server.log 2>&1
```

Open:

```txt
http://127.0.0.1:4173/index.html
```

Capture RN:

```bash
xcrun simctl io booted screenshot .tmp/rn-current.png
```

Capture HTML:

```bash
node .agents/skills/ui-distill/scripts/capture-html.mjs --page pages/app.html --width 1179 --height 2556 --output .tmp/html-current.png
```

Measure:

```bash
python3 .agents/skills/ui-distill/scripts/measure.py <ios-mask.png> <html-mask.png>
```

## Completion Standard

For a first pass, `pages/app.html` should be structurally faithful to `App.tsx`, use the fixed canvas, and visually match the RN page at the same state.

For iterative refinement:

- bbox deltas should trend to zero: `dx=0`, `dy=0`, `dw=0`, `dh=0`.
- after bbox alignment, improve `iou` and reduce `xor`.
- record unresolved differences as renderer/font rasterization risks instead of hiding them.
