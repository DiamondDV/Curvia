\# Active Context

## Current Phase
Phase 7 — Frontend (core flow complete, end-to-end tested, multiple bugs
fixed). Gemini repair stage replaced with code-based SVG structurer (item 11).
UI rewritten to the "Vector Studio" layout (item 12). Color accuracy and
SVG crispness improved (item 13). VTracer crash on segment_length fixed
(item 14). Passive-wheel-listener crash and prompt-not-cleared bug fixed
(item 15).

## Original Build (pre-debugging)
Created `app/page.tsx`: full flow — UploadZone/ImagePreview → color count +
optional Gemini key inputs → "Convert to SVG" button → ProgressStepper while
running → ResultsPanel on completion, with a "Convert another image" reset.
This was the last piece needed for a working end-to-end app: upload →
POST /api/process → poll status → fetch result → view/download SVG.

Everything in plan.md's core spec (Stages 1-5, orchestrator, store, worker,
all 3 API routes, and the full upload→result UI) was implemented at that
point. Remaining lower-priority items not yet built: `components/ui/`
(shadcn primitives — not needed yet, page.tsx uses plain Tailwind),
`lib/image/temp.ts` (temp-file helper — trace.ts already handles its own
temp files inline), and the `tests/` suite (unit/integration/golden) —
none written yet.

---

## Debugging Session — full log

### 1. Tailwind CSS was not being applied at all
**Symptom:** page loaded with correct DOM/content but zero styling — plain
black-on-white text, no layout.
**Root cause:** Tailwind v4 requires a separate `@tailwindcss/postcss`
package plus a `postcss.config.js`/`.mjs` registering it as the PostCSS
plugin (v4 changed from v3's direct-postcss-plugin model). Neither existed
in the repo — `package.json` only listed `"tailwindcss": "4.0.0"` as a dev
dependency, and there was no postcss config file anywhere. So
`app/globals.css`'s `@import 'tailwindcss';` was never being processed.
**Fix:**
- Added `@tailwindcss/postcss` to `devDependencies`.
- Created `postcss.config.mjs`:
  ```js
  export default {
    plugins: { '@tailwindcss/postcss': {} },
  };
  ```

### 2. Tailwind version mismatch crashed every page load
**Symptom:** after fix #1, every request to `/` started 500ing with:
`Error: Missing field 'negated' on ScannerOptions.sources`
**Root cause:** `tailwindcss` and `@tailwindcss/postcss` were both pinned to
the exact version `4.0.0` in package.json, but npm resolved the native
`@tailwindcss/oxide` scanner engine (a transitive dependency, not directly
pinned) to `4.3.2` — because `4.0.0` no longer has a matching build
available on the registry. `tailwindcss@4.0.0`'s JS and `oxide@4.3.2`'s
native binding speak incompatible internal APIs, hence the crash on the
`ScannerOptions.sources` struct.
**Fix:** changed both `tailwindcss` and `@tailwindcss/postcss` in
`package.json` from pinned `"4.0.0"` to `"^4.1.0"`, which resolves all
three packages (`tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/oxide`)
to the same matching `4.3.2`.

### 3. Pre-existing peer dependency conflict (noted, not "fixed", just worked around)
`framer-motion@11.3.0` declares a peer dependency on `react@^18.0.0`, but
the project is on React 19. `npm install` fails outright on this without
`--legacy-peer-deps`. Every `npm install` in this workspace going forward
needs that flag.

### 4. Gemini 1.5 Pro retired — swapped models
**Fix:** changed `GEMINI_MODEL` in `lib/ai/gemini.ts` from
`'gemini-1.5-pro'` to `'gemini-2.5-flash'`.

### 5. "Job not found" mid-pipeline — module-singleton bug in Next.js dev mode
**Root cause:** `lib/pipeline/store.ts` exported the job store as a plain
module-level singleton, giving separate instances to different API routes
in dev mode's per-route compilation.
**Fix:** pinned singleton to `globalThis` in both `store.ts` and
`abort-registry.ts`.

### 6. Gemini repair taking ~4 minutes then failing to extract SVG
**Root cause:** Gemini 2.5 Flash is a "thinking" model by default — thinking
tokens consumed the output budget before the SVG was fully written, and no
`generationConfig` was being sent so no ceiling was set.
**Fix:** added `generationConfig: { maxOutputTokens: 65536, thinkingConfig: { thinkingBudget: 0 } }`
to every Gemini request. Added `finishReason` tracking and explicit
`MAX_TOKENS` error in `repair.ts`.

### 7. "Unbound namespace prefix: inkscape" — strict XML parse failure after repair
**Root cause:** REPAIR_PROMPT instructed Gemini to emit `inkscape:label`
attributes but didn't require the `xmlns:inkscape` declaration on the root.
**Fix:** prompt updated + `ensureNamespacesDeclared()` defensive code in
`repair.ts`.

### 8. Visual artifact: small scratch/speckle marks along edges
**Root cause:** per-pixel nearest-color remapping flip-flops between palette
colors along anti-aliased edges → VTracer traces those as tiny stray paths.
**Fix:** added `sharp(...).median(3)` after posterization in `posterize.ts`.
**Status:** not yet re-tested by user.

### 9. MAX_TOKENS truncation recurred at 8-color setting
**Root cause:** `MAX_REPAIR_INPUT_BYTES` was sized against Gemini's input
context (1M tokens), not its *output* budget (65,536 tokens). SVG path data
at ~1 token/2-3 chars means the real output ceiling is ~130KB, not 500KB.
**Fix:** lowered threshold to 150KB in `lib/config/limits.ts`.
**Status:** not yet re-tested.

### 10. (Superseded by item 11) Threshold-lowering band-aid
A further lowering to 80KB and a UI amber warning were written as a stopgap.
Both were reverted when item 11 (proper fix) was implemented. `limits.ts`
`MAX_REPAIR_INPUT_BYTES` is now 500KB again (effectively a no-op dead
constant — no LLM repair stage calls it anymore).

### 11. Gemini repair replaced with code-based SVG structurer
**Root cause of original problem:** Gemini was asked to re-emit the *entire*
SVG — every path coordinate, unchanged — just to add `<g>` wrappers, IDs,
and `<title>` elements. An LLM is the worst possible tool for verbatim XML
restructuring: high latency, high token cost, truncation risk on any SVG
above ~80-130KB because the full output must fit in 65,536 output tokens.
This is what caused items 6, 9, and 10 — all symptoms of the same root
architectural mistake.
**Fix:** rewrote `lib/stages/repair.ts` as a deterministic code transform
using `@rgrove/parse-xml` (already a dependency, used in `validator.ts`):
1. Parse SVG → typed AST
2. Remove zero-area / empty paths (blank `d`, bare moveto, `M0 0`)
3. Remove exact-duplicate paths (same `d` string)
4. Remove background-flood paths (fill = palette[0], covers >80% viewBox
   by rough bounding-box estimate)
5. Group remaining `<path>` elements by fill color → `<g id="color-N">`
   with a `<title>` containing the hex color
6. Assign sequential `path-N` IDs to every path
7. Preserve root `<svg>` attributes exactly (viewBox, width, height, etc.),
   ensure `xmlns` is present
8. Rebuild SVG string and return

No Gemini call. No token budget. Runs in <5ms regardless of SVG size or
color count. `GeminiClient` is still accepted as a parameter (so the
orchestrator signature is unchanged) but is marked `_gemini` and never called.

**Changed files:**
- `lib/stages/repair.ts` — complete rewrite (code structurer, no LLM)
- `lib/pipeline/orchestrator.ts` — progress message changed from
  "Sending to Gemini…" → "Structuring SVG…" and validation error message
  updated to "Invalid SVG after structuring" (logic unchanged)
- `lib/config/limits.ts` — `MAX_REPAIR_INPUT_BYTES` restored to 500KB with
  a comment marking it as a no-op dead constant (no LLM stage uses it now)
- `app/page.tsx` — amber "8 colors skips repair" warning removed (no longer
  relevant; code structurer handles any size instantly)

**Status:** files written; **dev server restart required** before changes
take effect. Not yet tested in browser. Expected result: stage 4 completes
in milliseconds instead of 10-60+ seconds, no truncation errors at any
color count, Gemini API key field in the UI is now vestigial (Pollinations
still uses its own key; Gemini key does nothing in the main pipeline).

---

## Feature Addition: Text-to-image & image-to-image via Pollinations

User asked for two new capabilities, both built on Pollinations' unified
OpenAI-compatible API (`https://gen.pollinations.ai`):

1. **"Describe" mode (text → image → SVG):** user writes a text prompt,
   it's sent to Pollinations' `flux` model to generate an image, and that
   image is automatically fed into the existing conversion pipeline.
2. **"Describe changes" (image + text → edited image → SVG):** when a
   user has uploaded an image, they can optionally add a text description
   of changes to make. If filled in, clicking Convert first runs the
   image through Pollinations' `gptimage` model (image-to-image edit) via
   `/v1/images/edits`, then auto-runs the same SVG conversion on the
   edited result.

**New files:**
- `lib/ai/pollinations.ts` — `PollinationsClient` with `generateImage()` and `editImage()`
- `app/api/generate/route.ts` — thin proxy to Pollinations generate
- `app/api/edit/route.ts` — thin proxy to Pollinations edit

**Changed files:**
- `lib/utils/errors.ts` — widened `AIError.provider` to include `'pollinations'`
- `app/page.tsx` — Upload/Describe mode toggle, "Describe changes" textarea,
  `isGenerating`/`isEditing` busy states
- `.env` / `.env.example` — added `POLLINATIONS_API_KEY`

**Status: NOT YET CONFIGURED OR TESTED.**
`POLLINATIONS_API_KEY` is currently empty in `.env` — both routes return a
clear 500 until a real key is filled in.

---

## 12. UI rewrite — "Vector Studio" layout (light theme, sidebar + canvas)

User supplied a screenshot of a target design (single-column dark-theme
form → three-pane studio layout: top header, 360px left sidebar, right
canvas workspace) and asked for it directly, not a design brief — so this
was a faithful rebuild against the reference image, not a from-scratch
design pass.

**Layout implemented:**
- **Header** — logo mark + "CURVIA" wordmark, centered pill breadcrumb
  (`SOURCE — VECTORIZE — EXPORT`) with a green dot on whichever step is
  current. Step is derived state (`source` before any run, `vectorize`
  while `isBusy`, `export` once `pipeline.result` exists), not separately
  tracked.
- **Sidebar** (`app/page.tsx`) — "Describe the asset" textarea (500-char
  cap, live counter) + hint row, "Reference image" drop zone/preview,
  "Active pipeline" indicator, two toggle cards, two collapsible sections
  (Trace controls, API keys), primary "Generate & vectorize" button,
  stats footer.
- **Canvas** (`components/results/CanvasStage.tsx`, new) — Vector/Raster
  segmented tabs, dimensions + source label, "Show SVG source" toggle,
  zoom pill, black "Download SVG" button, checkerboard artboard with the
  actual preview centered on a white card.

**Unified the two text-input flows into one field.** The old UI had
separate `describePrompt` (generate mode) and `editPrompt` (upload mode)
textareas behind a mode switch. The mock has exactly one "Describe the
asset" field, so `app/page.tsx` now branches a single `describePrompt` at
submit time:
- reference image + prompt → `/api/edit` (Pollinations `gptimage`), result
  fed into the pipeline
- reference image, no prompt → straight to `/api/process`, no AI step
- no reference image, prompt present → `/api/generate` (Pollinations
  `flux`), result fed into the pipeline
- neither → primary button disabled

"Active pipeline" in the sidebar reflects this same branch live, labeled
`GPT Image / image-to-image edit`, `VTracer / direct vectorize`, or
`Flux / text-to-image` — deliberately not copying the mock's exact
"Flux Schnell" label, since the code actually requests model `'flux'`,
not `'flux-schnell'` (see `lib/ai/pollinations.ts`). Flagging the
discrepancy here rather than hardcoding a model name the backend doesn't
use.

**Two controls in the mock have no backend behind them yet:**
"Remove background" and "Black & white" toggles are rendered `disabled`
(visibly inert, not silently fake) — there's no such pipeline stage.
Wiring these would need a new stage (e.g. `sharp` alpha-matte removal,
`sharp` grayscale + threshold) plus new `ProcessRequest` fields end to
end; out of scope for a UI pass. Same treatment for "Trace controls":
only `colorCount` is real and adjustable (already wired); VTracer's other
params (`filterSpeckle`, `cornerThreshold`, `pathPrecision`, etc.) are
hardcoded in `lib/config/vtracer.ts` and not exposed, with a caption
saying so rather than showing dead sliders.

**Gemini API key field** — kept (only "bring your own key" hook that
exists, via `useLocalStorage`), but captioned as currently unused, per
item 8 above — still true, still vestigial.

**Empty state** — the mock is a pre-populated demo (owl SVG, "8 paths /
18 layers / 3.9 KB" footer). There's no real seeded sample in this repo,
so the canvas shows an honest empty state ("Nothing to preview yet")
until a real job produces a result, rather than hardcoding fake stats
matching the screenshot.

**New/changed files:**
- `app/page.tsx` — full rewrite (see above)
- `components/results/CanvasStage.tsx` — new, replaces `ResultsPanel.tsx`
  (deleted — its tab/download/stats responsibilities are now inline with
  the canvas toolbar instead of a block below a form)
- `components/results/SVGViewer.tsx` — refactored from self-contained
  (internal scale/offset state, own checkerboard bg) to fully controlled
  (`scale`/`offset`/`onScaleChange`/`onOffsetChange` props) so the
  toolbar's zoom buttons and in-canvas wheel/drag stay in sync
- `components/results/SVGCodeViewer.tsx` — restyled light theme only,
  logic unchanged
- `components/pipeline/ProgressStepper.tsx` — restyled light theme,
  renders as a floating card over the canvas during a run instead of
  inline in the form; "Repair" stage label changed to "Structure" to
  match item 11's rename
- `components/upload/UploadZone.tsx`, `ImagePreview.tsx` — restyled to
  the compact "Reference image" card footprint from the mock (same size
  in both empty/filled states, so swapping doesn't reflow the sidebar)
- `components/icons.tsx` — new, hand-rolled inline SVG icon set
  (lucide-style, 24×24 viewBox). No icon library dependency added.
- `components/ui/Toggle.tsx`, `components/ui/Collapsible.tsx` — new,
  small reusable primitives, no external UI lib
- `lib/utils/format.ts` — new, `formatBytes()` + `countLayers()` (counts
  `<g` wrappers in the SVG — closest real analog to "layers" mentioned in
  the mock; there's no explicit layer concept in the pipeline otherwise)
- `app/globals.css` — dark theme tokens replaced with light theme +
  `.checkerboard` utility class (two-gradient CSS trick, not an image
  asset) used behind the artboard
- `app/layout.tsx` — added `next/font/google` Inter, wired through
  Tailwind v4's `@theme inline { --font-sans: ... }` so `font-sans`
  actually resolves to Inter instead of the system stack

**Verification actually run (not just "it compiles"):**
- `npx tsc --noEmit` — zero errors
- Restarted dev server per the documented port-3001 procedure, confirmed
  `✓ Compiled / in 1954ms` and `GET / 200` in the log, no runtime errors
- Fetched the rendered page and grepped for the actual section text
  (`Vector Studio`, `Create an SVG`, `Active pipeline`, `Trace controls`,
  etc.) to confirm real server-rendered output, not just a 200 status
- `npx eslint` could not run — **pre-existing gap, not introduced by this
  change**: no `eslint.config.js` exists despite ESLint 9 being installed
  (v9 dropped `.eslintrc.*` support). Flagging as still open below.
- Not tested: actual browser interaction (drag/drop, pan/zoom drag,
  collapsible open/close, real `/api/generate` and `/api/edit` calls
  end-to-end) — no `POLLINATIONS_API_KEY` is configured (see feature
  section above), so the generate/edit paths still can't be exercised
  live, only their request-construction code changed.

---

## 13. Color accuracy & SVG crispness fixes

**Symptoms reported:** After item 11's code-based SVG structurer was
implemented, color generation became very incorrect and SVG crispness
degraded — results were no longer sharp and detailed.

**Root causes identified:**

1. **Median filter too aggressive**: The `median(3)` filter added in item 8
   to fix speckle artifacts (see item 8) was smoothing edges too much and
   causing color bleeding, especially at higher color counts. A 3×3 median
   filter replaces each pixel with the modal color in its neighborhood,
   which softens fine details and can merge nearby colors together.

2. **Aggressive background-flood removal**: Item 11's step 4 removed any
   path filling `palette[0]` that covered >80% of viewBox area. But:
   - The median-cut quantization algorithm doesn't guarantee `palette[0]`
     is the background color — it's just first in the returned array
   - This was incorrectly removing important foreground colors
   - The rough bounding-box estimate for area calculation was unreliable

3. **Color matching broken in repair**: `repair.ts` was using strict hex
   normalization but VTracer can output fill colors in multiple formats
   (`#abc`, `#aabbcc`, `rgb(R,G,B)`, named colors). The `normalizeHex()`
   function only handled hex formats, missing rgb() colors.

4. **VTracer parameters too aggressive for the missing median filter**:
   With `median(3)` handling edge smoothing, VTracer's `cornerThreshold: 60`
   was appropriate. But without it, those settings were over-smoothing
   corners and removing detail.

**Fixes implemented:**

1. **Removed the median(3) filter** from `posterize.ts`:
   - Eliminated aggressive edge smoothing that was degrading quality
   - Rely instead on VTracer's `--filter_speckle` parameter to discard
     single-pixel noise artifacts
   - If speckles persist, tune `filterSpeckle` in `lib/config/vtracer.ts`
     rather than applying image-level filtering

2. **Removed background-flood detection** from `repair.ts`:
   - Deleted step 4's aggressive path removal
   - Now keeps all paths from VTracer (empty/duplicate removal still happens)
   - Trusts VTracer's vectorization output directly

3. **Improved color matching in repair.ts**:
   - Added `normalizeColorForGrouping()` function that handles multiple
     color formats: hex (#abc, #aabbcc), rgb(R,G,B), rgba(...), named colors
   - Converts all formats to lowercase normalized hex for consistent grouping
   - Preserves original fill attribute in output for maximum fidelity

4. **Retuned VTracer parameters** in `lib/config/vtracer.ts`:
   - `filterSpeckle: 4 → 6` (more aggressive noise removal, now doing
     work the median filter used to do)
   - `cornerThreshold: 60 → 50` (sharper corners, less over-smoothing)
   - `lengthThreshold: 4.0 → 2.5` (finer segments to capture detail)
   - `pathPrecision: 3 → 4` (4 decimal places instead of 3 for geometry
     fidelity; tiny size trade-off for accuracy)

**Changed files:**
- `lib/stages/posterize.ts` — removed `median(3)` filter call
- `lib/stages/repair.ts` — removed background-flood detection (step 4),
  added `normalizeColorForGrouping()` to handle rgb/hex/named colors,
  improved path grouping logic
- `lib/config/vtracer.ts` — retuned all four VTracer parameters per above

**Status:** files written; **dev server restart required** before testing.
Expected result: SVG output should be significantly crisper with fine
detail preserved, colors should remain true to the source image without
incorrect removal or bleeding, edges should be sharp and well-defined.
Small speckles may appear if `filterSpeckle: 6` proves insufficient; if so,
increase further (7, 8) rather than re-adding the median filter.

**⚠️ Discrepancy found in item 14 below:** when `lib/config/vtracer.ts` was
actually read during item 14's investigation, its values did **not** match
what this entry describes (`lengthThreshold` was `2.0`, not the `2.5` stated
above as the "after" value; `filterSpeckle` was `8`, not `6`; `cornerThreshold`
was `45`, not `50`; `pathPrecision` was `5`, not `4`). Either this entry was
written before the file was actually saved, a later edit changed the values
again without a log entry, or a different working copy was edited. Whatever
the cause, **the numbers in this item's "Fixes implemented" section are
aspirational, not a reliable record of what's on disk** — trust the file
itself, not this log, for current parameter values. Also worth noting: 2.5
would have crashed VTracer too (see item 14) — the confirmed legal range for
`--segment_length` on this build is [3.5, 10], so even the *intended* value
here was never actually valid.

---

## 14. VTracer crash: "Segment length is invalid" (exit code 101)

**Symptom reported:** every conversion job failed at the tracing stage.
Terminal showed:
```
thread 'main' panicked at cmdapp/src/main.rs:234:17:
Out of Range Error: Segment length is invalid at 2. It must be within [3.5,10].
```
(The browser console screenshot sent alongside this had nothing to do with
it — 404 favicon, an unused font preload warning, and Fast Refresh logs are
all normal dev-mode noise, not the bug.)

**Root cause:** `lib/config/vtracer.ts`'s `lengthThreshold` (currently
found on disk as `2.0`) maps directly to VTracer's `--segment_length` CLI
flag (`lib/stages/trace.ts`). This VTracer build hard-rejects any value
outside `[3.5, 10]` and exits with code 101 — `2.0` was never a legal value
for it, regardless of which prior tuning pass set it or to what.

**Fix:** set `lengthThreshold` to `4.0` — inside the confirmed legal range,
with a small margin above the bare floor (3.5) as insurance against any
float-boundary rejection.

**Verification (not just "it compiles"):**
1. Ran `./bin/vtracer` directly with `--segment_length 2.0` against a
   trivial test PNG — reproduced the exact panic and exit code 101.
2. Ran the same binary with `--segment_length 4.0` — `Conversion
   successful.`, exit code 0.
3. Restarted nothing (dev server was already up) and hit the *actual
   running app* — `POST /api/process` with a real test image, polled
   `/status` to `"completed"` across all five stages, then fetched
   `/result` and confirmed a real, well-formed SVG came back
   (`pathCount: 1`, `svgSizeBytes: 196`, valid `<svg xmlns=...>` header).

**Changed files:**
- `lib/config/vtracer.ts` — `lengthThreshold: 2.0 → 4.0`, comment updated
  with the confirmed legal range and how it was verified

**Status:** fixed and verified end-to-end through the running app, not just
the CLI. Given the discrepancy noted in item 13 above, **it's worth
independently re-confirming `lib/config/vtracer.ts`'s on-disk values are
what you expect** before trusting any prior log entry's stated numbers,
including this one — re-read the file, don't just trust the log.

---

## 15. Passive-wheel-listener console error + "Active pipeline" mislabel

User reported two things after the item 14 fix: (1) a "1 error" badge in
Next.js's dev overlay while using the app, and (2) the vectorized owl in
the Vector tab looking visually different from a reference owl image they
compared it against.

**Investigated first, before touching anything:** pulled the actual dev
server log for the session. Confirmed only **one** `/api/generate` call
and one `/api/process` job ran (job `320fd650`, completed all 5 stages,
73 paths / 51 color groups) — no `/api/edit` call ever fired. This matters
because it rules out "an unwanted AI edit pass mutated the image" as the
cause of any visual difference; whatever's different, it isn't that.

### (a) The "1 error" console error — real bug, found and fixed
**Root cause:** `components/results/SVGViewer.tsx`'s wheel-to-zoom handler
called `e.preventDefault()` inside a React `onWheel` prop. React always
attaches wheel/touch listeners passively for scroll-performance reasons,
and calling `preventDefault()` inside a passive listener throws exactly:
`Unable to preventDefault inside passive event listener invocation` —
every scroll over the canvas. This was introduced in item 12's SVGViewer
refactor to controlled zoom/pan; the previous self-contained version had
the same call, so this bug predates item 12, but item 12 is where it was
last touched.
**Fix:** replaced the synthetic `onWheel` prop with a real
`addEventListener('wheel', handler, { passive: false })` in a `useEffect`,
attached to a `containerRef`. React's synthetic wheel binding can't be
configured non-passive; a native listener is the only way to get a
cancelable one. A `useRef` holds the latest `scale`/`onScaleChange` so the
native listener doesn't need to be re-attached on every scale change.
**Changed files:** `components/results/SVGViewer.tsx`

### (b) "Active pipeline" mislabeled after a successful generate
**Root cause:** in `app/page.tsx`, after a successful `/api/generate` (or
`/api/edit`) call, `upload.setFile(generatedFile)` was called but
`describePrompt` was never cleared. Since "Active pipeline" is computed
live from `upload.file && describePrompt.trim()`, the sidebar kept showing
`GPT Image / image-to-image edit` after a plain text-to-image generation
completed — because as far as the state was concerned, there was now both
a reference image *and* a non-empty prompt, exactly the condition for edit
mode. This was cosmetically wrong for the run that already happened (log
confirms it actually went through Flux generate, not gptimage edit), but
it also meant a **second click** of "Generate & vectorize" at that point
would have actually sent the freshly-generated image through an
unrequested `/api/edit` pass with the same prompt re-applied as an edit
instruction — a real latent bug, not just a display glitch.
**Fix:** added `setDescribePrompt('')` right after `upload.setFile(...)`
in both the generate and edit success paths, so the prompt is treated as
"consumed" once it's produced a result. A user who wants to edit again
now has to type a new instruction, which matches what "Describe the
asset" implies each time you use it.
**Changed files:** `app/page.tsx`

### (c) Visual color/style difference — not conclusively diagnosed
Could not confirm this is a pipeline bug vs. two different source images
being compared. Only one generate+vectorize run happened this session, so
there's no confirmed "same image, before vs. after" pair to point at.
Also relevant: `posterize.ts` has adaptive color-count logic (detects
image complexity/entropy and can push the palette up to 12 colors
regardless of the "Colors" dropdown) — this is intentional behavior, not
a bug, but can surprise if you expect exactly N colors. Asked the user to
compare the same job's own Raster vs. Vector tab directly (guaranteed
same source, no ambiguity) rather than an externally-sourced comparison
image whose generation run isn't confirmed. Not yet resolved.

**Verification:**
- `npx tsc --noEmit` — zero errors after both fixes
- Restarted dev server per the documented procedure, confirmed clean
  "Ready" with no errors in the log
- Not yet re-tested in-browser for the wheel-zoom fix specifically (needs
  an actual scroll-to-zoom interaction, which can't be done from this
  sandbox) — logic verified by code inspection (passive listener +
  preventDefault is a well-known, unambiguous browser behavior) but not
  by reproducing the console error before/after in a real browser

**Status:** (a) and (b) fixed and typechecked, dev server restarted.
(c) still open — needs the user's Raster-vs-Vector comparison on the same
job to make progress.

---

## Dev environment / networking notes (important, don't relitigate)

- Only **port 3000** is exposed externally (Cloudflare tunnel → Scribe MCP
  server). **Never kill the process on port 3000.**
- Curvia dev server always lands on **port 3001** (Next.js auto-increments).
- **Reliable restart procedure:**
  1. `ss -ltnp | grep ':3001'` → get real OS pid
  2. `kill -9 <pid>`
  3. Confirm free: `ss -ltnp | grep ':300[01]'` shows only 3000
  4. `run_command_background`: `npm run dev > /tmp/curvia-dev.log 2>&1` (cwd: `site/Curvia`)
  5. `sleep 4 && cat /tmp/curvia-dev.log` → confirm "Ready" on 3001
- The app is also reachable on the local network at the host's LAN IP
  (e.g. `http://192.168.1.8:3001`) since Next.js dev binds to all
  interfaces (`ss` shows `*:3001`) — only port 3000 has an external
  tunnel, though; 3001 is LAN-only.
- `npm install` must use `--legacy-peer-deps` (framer-motion/React 19 conflict).
- Scribe `read_file`/`write_file` have no str_replace — every edit is a full rewrite.
  (Confirmed again this session: the general-purpose `str_replace`/`create_file`
  tools in this environment are bound to a *different* sandbox filesystem than
  the Scribe MCP workspace and silently target the wrong filesystem — always
  use `ScriptScribe:write_file` for edits here, never the generic ones.)
- No outbound network from Claude's tool sandbox — Pollinations/Gemini calls
  only happen inside the running Next.js process.
- **This file can drift from reality** (see items 13/14 above) — if a prior
  log entry's stated file contents seem important, verify by re-reading the
  actual file before relying on the log's description of it.
- The svgo-node.js "Critical dependency: the request of a dependency is an
  expression" webpack warning that appears constantly in the dev log is
  harmless pre-existing noise from how `svgo-node.js` resolves plugins
  dynamically — not a real error, don't chase it.

---

## Initial code review findings — still open

1. **Dockerfile prod boot broken** — `output: 'standalone'` but CMD points
   to non-existent `server.js` at root; needs standalone copy steps.
2. **VTracer version mismatch** — `bin/vtracer` is 0.6.4 locally but
   Dockerfile downloads 0.6.3; flag names may differ.
3. **`store.sweepExpired()` never called** — memory leak; needs a
   `setInterval` at startup.
4. **`job.cached` always false** — informational field, low impact.
5. **`worker.ts` dead `queue` array** — vestigial, harmless.
6. **No geometry-fidelity validation** — `validateSVG()` doesn't diff
   path `d=""` data pre/post repair.
7. **Test suite not written** — `tests/` directories all empty.
8. **Gemini API key field in UI is now vestigial** — the main pipeline no
   longer calls Gemini at all. Key field only matters if Gemini is re-added
   for optional semantic labeling (Part B, not yet implemented). Could be
   hidden or removed from the UI to avoid confusion.
9. **No `eslint.config.js`** — `npm run lint` / `npx eslint` fail outright
   on ESLint 9 (needs the new flat-config format; the old `.eslintrc.*`
   style isn't picked up). Not introduced this session, just newly hit
   while trying to verify the UI rewrite.
10. **Remove background / Black & white toggles are UI-only** — added in
    the Vector Studio layout rewrite, rendered disabled. No backend stage
    exists for either yet.
11. **ACTIVE_CONTEXT.md log entries can drift from actual file contents**
    — item 13 describes VTracer parameter values that didn't match what
    was actually on disk when item 14 checked. Worth periodically diffing
    this file's claims against the real source, not just trusting it.
12. **Adaptive color count can silently exceed the UI's "Colors" selector**
    — `posterize.ts`'s complexity detection can push the actual palette up
    to 12 regardless of the 4/6/8 dropdown value. Intentional, but not
    surfaced anywhere in the UI, so results can look inconsistent with what
    was selected. Consider showing the *actual* color count used somewhere
    (e.g. next to "N paths / N layers" in the stats footer).
13. **Visual color/style regression reported, not yet confirmed as a real
    bug** — see item 15(c). Needs a controlled same-job Raster-vs-Vector
    comparison to make progress; an externally-sourced comparison image of
    uncertain provenance isn't enough to diagnose against.

---

## Working conventions

Append a summary to this file (`ACTIVE_CONTEXT.md`) for every change made,
following the numbered-item format above (Symptom / Root cause / Fix / Status).
