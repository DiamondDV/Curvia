\# Active Context

## Current Phase
Phase 7 — Frontend (core flow complete — app is end-to-end wired AND has been
manually tested through a real run in dev mode, with several real bugs found
and fixed along the way — see "Debugging Session" below for full detail).
Two new features added this session (text-to-image + image-to-image via
Pollinations) — see "Feature Addition" section below.

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

## Debugging Session (this session) — full log

Context: the app had never actually been run end-to-end in a browser before
this session. Asked to review plan.md vs. the implementation first (see
"Initial code review findings" below), then to actually start the dev
server and click through it. Multiple real, previously-undiscovered bugs
surfaced. All are now fixed. In order encountered:

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
to the same matching `4.3.2`. Verified via
`cat node_modules/{tailwindcss,@tailwindcss/postcss,@tailwindcss/oxide}/package.json`
that all three now report `4.3.2`.

### 3. Pre-existing peer dependency conflict (noted, not "fixed", just worked around)
`framer-motion@11.3.0` declares a peer dependency on `react@^18.0.0`, but
the project is on React 19. `npm install` fails outright on this without
`--legacy-peer-deps`. Every `npm install` in this workspace going forward
needs that flag until either framer-motion is upgraded to a React-19-aware
version or downgraded/replaced. Not blocking — works fine in practice — but
flagged as a loose end in package.json that should be cleaned up before a
real deploy (`npm ci` in the Dockerfile will hit the same wall).

### 4. Gemini 1.5 Pro retired — swapped models
**Symptom:** user reported Gemini 1.5 Pro no longer available on their
account/quota (confirmed independently: every Pro-tier model, including
Gemini 2.5 Pro and 3.1 Pro, showed 0/0 quota; only Flash-tier models had
real quota).
**Fix:** changed `GEMINI_MODEL` in `lib/ai/gemini.ts` from
`'gemini-1.5-pro'` to `'gemini-2.5-flash'` — chosen because it's non-preview
(more stable than the Preview-tier models on the list), supports
multimodal input (image + text, which `repair.ts` needs), and had the
healthiest quota of the available options (5 RPM / 250K TPM / 20 RPD at
the time). Also updated a stale comment in `repair.ts` that referenced
"Gemini 1.5 Pro's 1M token context window" (2.5 Flash also has a 1M
context window, so the comment logic still holds, just fixed the model
name).

### 5. "Job not found" mid-pipeline — module-singleton bug in Next.js dev mode
**Symptom:** a freshly created job (confirmed alive and actively processing
server-side, later completing successfully in the log) would occasionally
404 on a `/status` poll partway through, and the frontend gave up polling
right there, permanently showing "Job not found" even though the pipeline
kept running and completed fine server-side.
**Root cause:** `lib/pipeline/store.ts` exported the job store as a plain
module-level singleton: `export const store = new JobStore();`. That's
safe in a production build (one bundle), but in Next.js **dev mode**,
individual API routes can get compiled into separate, independent module
graphs — especially right after editing a file that route transitively
imports (which was happening constantly during this session as fixes were
applied). If `POST /api/process` and `GET /api/process/[jobId]/status` end
up compiled at different times, each can get its own separate instance of
`store`, so a job created via one is invisible to the other. Confirmed via
server log: `POST /api/process 200` → job progressing through stages with
log lines → one `/status` poll returning 404 mid-flight → then more
progress lines → eventual "Pipeline completed" — i.e., a real job that a
different code path just couldn't see for one request.
**Fix:** pinned the singleton to `globalThis` in `lib/pipeline/store.ts`:
```ts
declare global {
  var __curviaJobStore: JobStore | undefined;
}
export const store = globalThis.__curviaJobStore ?? (globalThis.__curviaJobStore = new JobStore());
```
Applied the identical fix to `lib/pipeline/abort-registry.ts` (same
plain-module-singleton pattern, same latent bug, just not yet triggered
since there's no cancel endpoint wired up to it yet). In production this
is a no-op — there's only ever one instance either way — so it's a pure
dev-mode reliability fix with no downside.

### 6. Gemini repair taking ~4 minutes then failing to extract SVG
**Symptom:** repair stage would sit on "Sending to Gemini…" for ~4 minutes,
then fail with `[repairing] Could not extract SVG from Gemini response`.
**Root cause (inferred, not directly confirmed via API introspection since
Gemini's API doesn't expose thinking-token counts in the response body we
were parsing):** Gemini 2.5 Flash is a "thinking" model by default — it
spends part of its output token budget on internal reasoning before
writing the visible response. For a deterministic cleanup task like SVG
repair, that's wasted latency and, worse, risks the actual SVG output
getting truncated mid-write once the thinking + output tokens hit the
default max-output-tokens ceiling (no `generationConfig` was being sent at
all, so the API default applied). A response cut off before its closing
`</svg>` tag fails both of `extractSVG()`'s regexes (fenced code block,
raw `<svg>...</svg>`), producing the generic "could not extract" error
with no diagnostic detail.
**Fix, in `lib/ai/gemini.ts`:**
- Added an explicit `generationConfig` sent with every request:
  `{ maxOutputTokens: 65536, thinkingConfig: { thinkingBudget: 0 } }` —
  disables extended thinking (not needed for this task) and raises the
  output ceiling so a large repaired SVG has room to complete.
- Added `finishReason` to the `GeminiResponse` type (was previously only
  capturing `candidates[].content.parts[].text`, silently discarding
  finishReason/promptFeedback).
**Fix, in `lib/stages/repair.ts`:**
- Now checks `promptFeedback.blockReason` and throws a specific error if
  Gemini safety-blocked the request.
- Now checks `finishReason === 'MAX_TOKENS'` explicitly and throws a
  specific, actionable error ("response was truncated... try again, or
  reduce color count") instead of the generic extraction failure.
- `extractSVG()` now logs a preview (first 500 chars) of the raw response
  text via the structured logger before throwing, so a future extraction
  failure is diagnosable from server logs instead of a bare error string.
**Result after fix:** repair completed fully and much faster once retested
(exact timing not re-measured, but no longer hit the ~4 minute mark or
truncation on the next run).

### 7. "Unbound namespace prefix: inkscape" — strict XML parse failure after repair
**Symptom:** after fix #6 got Gemini to return a complete, non-truncated
response, `validateSVG()` (which uses the strict `@rgrove/parse-xml`
parser) failed with `<input>:2:47: Unbound namespace prefix: "inkscape"`.
**Root cause:** `lib/config/prompts.ts`'s `REPAIR_PROMPT` instructs Gemini
to "Add inkscape:label attributes matching the id for Inkscape
compatibility" but never instructed it to also declare the `inkscape` XML
namespace (`xmlns:inkscape="..."`) on the root `<svg>` element. Any
spec-compliant XML parser correctly rejects a namespaced attribute whose
prefix was never declared — this was a straightforward gap in the original
prompt (present since plan.md's original draft of this prompt, not
something introduced during implementation).
**Fix, two layers:**
1. **Prompt fix** (`lib/config/prompts.ts`): added an explicit instruction
   that any `inkscape:*` attribute usage requires declaring
   `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"` on the
   root `<svg>`, and reinforced this under OUTPUT REQUIREMENTS too
   ("every namespace prefix you use must be declared with a matching
   xmlns:<prefix> attribute on the root svg").
2. **Code-level safety net** (`lib/stages/repair.ts`): added
   `ensureNamespacesDeclared()`, run on the extracted SVG right after
   `extractSVG()` and before validation. It checks the raw SVG text for
   usage of known prefixes (`inkscape:`, `sodipodi:`) via regex, and if a
   prefix is used but its `xmlns:<prefix>` declaration is missing from the
   root `<svg>` tag, injects the correct declaration automatically. This
   mirrors the exact same defensive pattern `trace.ts`'s `ensureViewBox()`
   already used for a different missing-attribute problem — don't rely on
   an external tool (VTracer, or here, an LLM) to always produce spec-
   compliant output; patch it defensively downstream. This means even if
   Gemini forgets the prompt instruction on some future run, the pipeline
   won't fail on it.

### 8. Visual artifact: small scratch/speckle marks along edges in the traced SVG
**Symptom:** user uploaded the converted SVG output and pointed out small
diagonal scratch-like marks near the checkmark stroke and along the card's
folded-corner edge — visually, small disconnected jagged line fragments
that don't belong to the actual icon.
**Root cause:** `posterize.ts`'s `nearestColor()` remapping is done
independently per pixel. Along anti-aliased diagonal edges in the source
image (where the original PNG blends gradually between two colors over
several pixels), independent per-pixel nearest-color assignment can
flip-flop between two palette colors from one pixel to the next —
"salt-and-pepper" noise along the boundary instead of a single clean
edge. VTracer then dutifully traces every one of those isolated
mis-classified pixels/small clusters as its own tiny path, which is
exactly what shows up as scratch/speckle marks in the final SVG. VTracer's
`filter_speckle` config (in `lib/config/vtracer.ts`, currently `4`,
meaning "discard patches smaller than 4px") wasn't (isn't necessarily)
catching all of these because they can be thin *elongated* slivers along
an edge rather than compact "specks" — speckle filtering targets isolated
blobs, not necessarily 1px-wide edge noise.
**Fix, in `lib/stages/posterize.ts`:** added a median filter
(`sharp(...).median(3)`) to the flat/quantized image right before it's
re-encoded to PNG and handed to the trace stage. A median filter replaces
each pixel with the modal (most common) color in its immediate
neighborhood — this erases isolated single-pixel misclassification noise
while leaving real edges and shapes intact. Deliberately chosen over
blurring the image *before* quantization (which would soften real edges
too, trading one kind of artifact for a blurrier, less accurate trace) —
median-filtering *after* quantization is surgical: it only touches pixels
that are already outliers relative to their neighborhood.
**Status:** fix applied and dev server restarted with it; **not yet
re-tested by the user as of this note being written** — this is the most
recent change in the session. If speckle marks persist after this, the
next lever to pull is bumping `filterSpeckle` in `lib/config/vtracer.ts`
from `4` up to something like `8`, as a second line of defense (median
filter should catch most of it; speckle threshold is a coarser
backstop for anything median doesn't).

### 9. MAX_TOKENS truncation recurred at 8-color setting — skip threshold was wrong metric
**Symptom:** user hit the same "[repairing] Gemini response was truncated
(hit MAX_TOKENS)" error from fix #6, this time reproduced live in the
browser (see screenshot) with **8 colors** selected (the max option).
Confirmed the fix #6 generationConfig (`maxOutputTokens: 65536`,
`thinkingConfig.thinkingBudget: 0`) was still correctly in place in
`lib/ai/gemini.ts` — so the earlier fix wasn't broken, it was just
insufficient for this input size.
**Root cause:** `MAX_REPAIR_INPUT_BYTES` (in `lib/config/limits.ts`,
was `500 * 1024`) is supposed to skip Gemini repair for SVGs too large to
safely repair, but it was sized against Gemini's 1M-token *input* context
— not the real constraint, which is the 65,536 *output* token cap the
repair stage has to write the entire repaired SVG back into. SVG path
data tokenizes at roughly 1 token per 2-3 characters (worse than normal
prose), so the practical output ceiling is closer to 150-200KB of SVG
text. At 8 colors, VTracer produces more paths and a bigger raw SVG —
big enough to clear the old 500KB skip-check but still overflow the
65,536-token output budget once Gemini tries to reproduce it.
**Fix, in `lib/config/limits.ts`:** lowered `MAX_REPAIR_INPUT_BYTES` from
`500 * 1024` to `150 * 1024`, with an updated comment explaining the
output-token reasoning (previous comment referenced the input-context
budget, which was the wrong constraint). Now oversized raw SVGs skip
Gemini repair gracefully (SVGO still runs afterward) instead of reaching
Gemini and hard-failing with a truncation error.
**Status:** fix applied, dev server restarted via the documented
port-3001 restart procedure (killed real OS pid 17109 bound to the port,
confirmed only 3000 remained, relaunched `npm run dev`, confirmed
"Ready" in the log). **Not yet re-tested by the user** — next step is
retrying the same image at 8 colors to confirm it either completes with
repair or skips repair silently and still produces a valid SVG. If
genuinely huge traces still trip this, the next lever is reducing
VTracer's path precision to shrink the raw SVG itself, rather than
lowering the threshold further (which would just skip repair on more
images).

---

## Feature Addition (this session): Text-to-image & image-to-image via Pollinations

User asked for two new capabilities, both built on Pollinations' unified
OpenAI-compatible API (`https://gen.pollinations.ai`):

1. **"Describe" mode (text → image → SVG):** user writes a text prompt,
   it's sent to Pollinations' `flux` model to generate an image, and that
   image is automatically fed into the existing conversion pipeline —
   confirmed with the user that this should auto-run the full SVG
   conversion immediately (using whatever color count is currently
   selected), not just populate the preview and wait for a manual click.
2. **"Describe changes" (image + text → edited image → SVG):** when a
   user has uploaded an image, they can optionally add a text description
   of changes to make. If filled in, clicking Convert first runs the
   image through Pollinations' `gptimage` model (image-to-image edit) via
   `/v1/images/edits`, then auto-runs the same SVG conversion on the
   *edited* result.

**Design decision — kept entirely outside the existing pipeline.** Neither
feature touches the orchestrator, stage types, or `/api/process` at all.
Both are pure upstream steps: a new API route calls Pollinations, returns
raw image bytes, and the frontend wraps those bytes into a `File` via
`upload.setFile()` (the same state `useFileUpload` already exposes for a
manual drag-and-drop upload) before calling `pipeline.start()` — so from
the pipeline's point of view, a Pollinations-generated image is
indistinguishable from a manually uploaded one. This avoids adding any new
stage types, avoids touching `runPipeline`/`store`/`worker`, and means the
9 debugging-session fixes above and the pipeline's existing behavior are
untouched.

**New files:**
- `lib/ai/pollinations.ts` — `PollinationsClient` with `generateImage()`
  (`POST /v1/images/generations`, model `flux`, `response_format:
  b64_json`) and `editImage()` (`POST /v1/images/edits`, multipart,
  model `gptimage`). Mirrors `GeminiClient`'s exponential-backoff retry
  pattern (retry on 429/5xx, fail fast on other 4xx) for consistency.
  `extractImageBuffer()` decodes `b64_json` directly; falls back to
  fetching a `url` field server-side if a model ever ignores the
  requested response format.
- `app/api/generate/route.ts` — `POST { prompt, model? }` → calls
  `generateImage()` → returns raw `image/png` bytes. No job/store
  involvement; this is a thin proxy, not a pipeline stage.
- `app/api/edit/route.ts` — `POST` multipart `{ image, prompt, model? }`
  → calls `editImage()` → returns raw `image/png` bytes. Same
  thin-proxy shape as `/api/generate`.

**Changed files:**
- `lib/utils/errors.ts` — widened `AIError.provider` from `'gemini'` to
  `'gemini' | 'pollinations'` so the new client can reuse the existing
  error type/status-code conventions instead of inventing a parallel one.
- `app/page.tsx` — added an Upload/Describe mode toggle at the top.
  Upload mode gained an optional "Describe changes" textarea (only shown
  once a file is selected) that triggers the `/api/edit` → auto-convert
  chain on submit if filled; otherwise behaves exactly as before. Describe
  mode is a prompt textarea + "Generate & Convert" button that triggers
  the `/api/generate` → auto-convert chain. Added `isGenerating`/
  `isEditing` busy states (separate from the existing pipeline `isRunning`)
  so the UI can show "Generating image…" / "Applying AI edit…" during the
  Pollinations call itself, before the familiar `ProgressStepper` for the
  posterize/trace/repair pipeline takes over.
- `.env` / `.env.example` — added `POLLINATIONS_API_KEY` (`sk_...`, server-
  only, never sent to the browser).

**Status: NOT YET CONFIGURED OR TESTED.**
- `POLLINATIONS_API_KEY` is currently **empty** in `.env** — neither
  `/api/generate` nor `/api/edit` will work until a real `sk_...` key from
  enter.pollinations.ai is filled in. Both routes return a clear 500
  ("POLLINATIONS_API_KEY is not configured on the server") rather than a
  confusing failure if called before that.
- Dev server has been restarted with this code in place (same port-3001
  restart procedure as the other fixes), but **the two new flows have not
  been exercised end-to-end yet** — no Pollinations key to test against,
  and the user hasn't clicked through either "Describe" or "Describe
  changes" in the browser. Next step once a key is added: generate a
  simple test image via "Describe" mode and confirm it flows all the way
  through to a completed SVG, then repeat for "Describe changes" on an
  uploaded image.
- Not yet handled: no client-side validation/feedback for very long
  prompts (Pollinations caps `prompt` at 32000 chars per the API docs —
  currently would just surface as a 4xx from Pollinations, unstyled). Low
  priority unless it comes up in testing.
- Not yet handled: Pollinations account balance/budget exhaustion (`402`)
  surfaces as a generic error message via the existing `AIError` →
  `CurviaError` → JSON error path; not distinguished from other failure
  modes in the UI. Same treatment as any other error today, just noting
  it's untested.

---

## Dev environment / networking notes (important, don't relitigate)

- This Scribe workspace runs on a single Linux box. Only **port 3000** is
  exposed to the outside world, via a Cloudflare tunnel
  (`~/.cloudflared/config.yml`, tunnel name `my-mcp`, ingress rule
  `mcp.toolcloud.qzz.io → localhost:3000`).
- Port 3000 is **already occupied by the Scribe MCP server itself**
  (`node src/server.js`, pid was 10545 at last check) — this is the
  literal backend powering this MCP session. **Never kill this process or
  repurpose port 3000** — doing so would cut off the current session's
  connectivity.
- Because of this, `npm run dev` for Curvia always falls back to
  **port 3001** (Next.js auto-increments when 3000 is taken). The user has
  been accessing `localhost:3001` directly — confirmed they have some form
  of direct access to this same machine (not going through the Cloudflare
  tunnel, which only forwards 3000). Don't assume port 3001 is
  internet-reachable in general; it happens to work for this user's setup.
- **Known operational gotcha:** killing a `next dev` background process via
  Scribe's `kill_process` (SIGTERM) does **not** reliably kill the
  underlying `next-server` child process — it was repeatedly observed
  still holding the port afterward (`list_processes` even kept showing the
  Scribe-tracked process as "running" indefinitely after SIGTERM). The
  reliable restart procedure used throughout this session:
  1. `ss -ltnp | grep ':3001'` to find the actual OS pid bound to the port
  2. `kill -9 <that pid>` directly (not via Scribe's kill_process/pid
     tracking, which doesn't correlate reliably to the real child process)
  3. Confirm the port is free: `ss -ltnp | grep ':300[01]'` should show
     only 3000 (the MCP server)
  4. `run_command_background`: `npm run dev > /tmp/curvia-dev.log 2>&1`
     with cwd `site/Curvia`
  5. `sleep 4 && cat /tmp/curvia-dev.log` to confirm it landed on 3001 and
     says "Ready"
- Every fix in this session required a full restart via that procedure
  (in-memory job store + hot module state don't reliably survive editing
  files that the running dev server has already compiled/cached from).
- `npm install` in this repo **must** use `--legacy-peer-deps` (see item 3
  above) or it fails outright on the framer-motion/React 19 conflict.
- Scribe's filesystem tools (`read_file`/`write_file`) have no
  str_replace/patch equivalent — every edit in this session was a full
  read-then-rewrite of the target file. Slower than a diff-based edit but
  not a real problem at this codebase's current size.
- **No outbound network access from Claude's own bash/tool sandbox** —
  Pollinations (and Gemini) calls only happen from *inside* the running
  Next.js dev server process on this box, never fetched directly by
  Claude's tools. This is why the Pollinations integration above is
  "written but not yet tested by Claude" rather than verified end-to-end —
  only the user, via the browser, can actually exercise it right now.

---

## Initial code review findings (before any live testing) — still open

These were found reading plan.md against the implementation, before ever
running the app. Not yet fixed / not yet hit in live testing, but real and
worth fixing before a production deploy:

1. **Dockerfile likely won't boot in production.** `next.config.js` sets
   `output: 'standalone'`, which makes `next build` emit the runnable
   server at `.next/standalone/server.js` (expects `.next/static` and
   `public/` copied alongside it). The `Dockerfile` just runs
   `npm run build` then `CMD ["node", "server.js"]` from `/app` root —
   there's no `server.js` there. Needs either a
   `COPY --from=build /app/.next/standalone ./` step (plus copying
   `.next/static` into the right place) or dropping `output: 'standalone'`
   entirely.
2. **VTracer version mismatch risk.** The bundled `bin/vtracer` used
   locally in this workspace is confirmed **0.6.4** (ran `--version`
   directly), and `lib/stages/trace.ts` correctly uses 0.6.4's
   underscore-separated CLI flags (`--color_precision`, `--segment_length`,
   etc. — confirmed via `--help` output). But `Dockerfile` downloads
   **0.6.3** from GitHub releases for the production image. If 0.6.3's CLI
   uses different flag names (as plan.md's original hyphenated-flag
   assumption suggests it might), the production container would install
   a binary that doesn't understand the flags trace.ts sends, and tracing
   would fail at runtime in prod despite working fine here in dev. Should
   pin Dockerfile to 0.6.4 explicitly, or verify 0.6.3's actual flag
   syntax before trusting it.
3. **`store.sweepExpired()` is dead code.** Its own doc comment says "call
   periodically (see lib/pipeline/worker.ts)", but nothing in worker.ts —
   or anywhere else in the codebase — ever calls it
   (`grep -rn "sweepExpired"` only finds the definition). Expired jobs are
   rejected on `get()` via `JobExpiredError` but never actually removed
   from the in-memory `Map`, so the store grows unbounded over the
   process's lifetime. Slow memory leak, not the fast one plan.md already
   solved (per-job Buffer cleanup). Needs an actual periodic call, e.g. a
   `setInterval` somewhere at server startup.
4. **`job.cached` is always `false`.** Set at creation in `job.ts` and
   never mutated to `true` anywhere afterward
   (`grep -rn "\.cached"` confirms). `POST /api/process`'s cache-hit path
   in `route.ts` correctly returns `{ cached: true }` in that response,
   but the underlying job object's own `.cached` field never reflects it,
   so `GET .../result`'s `ResultResponse.cached` field is misleading —
   always reports `false` even for a cache hit. Low-impact (informational
   field only) but should be fixed for correctness — either set
   `job.cached = true` in the cache-hit path, or drop the field from
   `PipelineJob` and derive it purely at the API layer.
5. **`worker.ts` has a vestigial dead `queue` array.** Declared, and
   `run()` calls `queue.shift()` in its `finally` block, but nothing ever
   pushes to it — at capacity, `enqueue()` throws `CapacityError`
   immediately instead of queueing. Harmless (always empty, so
   `queue.shift()` is always a no-op `undefined`), but it's dead code
   carried over verbatim from an inconsistency already present in
   plan.md's own pseudocode. Either implement real queueing or remove the
   dead array.
6. **SVG geometry-fidelity validation gap (acknowledged in plan.md
   itself).** `validateSVG()` checks structural well-formedness
   (viewBox, xmlns, duplicate ids, empty paths, path/size limits) but does
   **not** diff path `d=""` data between `svgRaw` (pre-Gemini) and
   `svgRepaired` (post-Gemini) to catch the model silently altering
   geometry despite being instructed not to. plan.md's own "What's Still
   Hard" section calls this out as known/unfinished — comparing path
   counts and a sample of `d` values between raw and repaired SVG "is
   extra validation work not yet spec'd." Still true; not implemented.
7. **Test suite not written.** `tests/unit/`, `tests/integration/`,
   `tests/golden/` are all empty per the folder structure — `ACTIVE_CONTEXT.md`
   itself already flagged this as the suggested next step before this
   debugging session started.

---

## Current server state (as of end of this session)

- Dev server running via Scribe background process, on **localhost:3001**
  (port 3000 is occupied by MCP infra — see networking notes above).
- Latest restart included everything from the debugging session (Tailwind
  fix, Gemini model swap, job-store `globalThis` fix, inkscape-namespace
  fix, posterize median-filter fix, `MAX_REPAIR_INPUT_BYTES` threshold
  fix) **plus** the new Pollinations text-to-image / image-to-image
  feature (mode toggle in `app/page.tsx`, `/api/generate`, `/api/edit`,
  `lib/ai/pollinations.ts`).
- **Not yet confirmed by the user:**
  - whether the median filter fix (item 8) actually resolves the
    scratch-mark artifacts.
  - whether the lowered `MAX_REPAIR_INPUT_BYTES` (item 9) resolves the
    MAX_TOKENS truncation at 8 colors.
  - **the entire Pollinations feature is untested** — blocked on
    `POLLINATIONS_API_KEY` being filled in (currently empty in `.env`).
- If speckle artifacts persist after the median filter, next lever: bump
  `filterSpeckle` in `lib/config/vtracer.ts` from `4` to ~`8`.
- If MAX_TOKENS truncation persists despite the lowered threshold, next
  lever: reduce VTracer path precision to shrink the raw SVG itself.
- The 7 items under "Initial code review findings" above are all still
  open and un-fixed — none of them have caused a failure in live testing
  yet (Docker/prod-only concerns, or low-impact correctness issues), but
  should be addressed before any real deployment.

---

## Working conventions

- Starting this session: append a summary of every change made to this
  file (`ACTIVE_CONTEXT.md`), following the numbered-item format used in
  the "Debugging Session" log above (Symptom / Root cause / Fix / Status)
  for bug fixes, or a similarly structured writeup for new features (see
  "Feature Addition" section above for the template used).
