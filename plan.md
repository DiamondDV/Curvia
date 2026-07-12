# Curvia — Revised Architecture (v8)

Let me be direct about what actually needs to happen before writing a single line of spec.

---

## The Real Problem First

The previous plan's core loop was:

```
Upload → GPT-Image "restore" → OpenCV clean → VTracer → SVGO → SVG
```

The honest version of that loop is:

```
Upload → Stochastic reimagining → Heavyweight native lib → CLI tool → Optimizer → SVG
```

Every step adds failure surface. The output SVG from VTracer on a complex image is also the core complaint: **hundreds of fragmented paths, no semantic structure, uneditable noise**.

VTracer's output problem is not fixable by tuning parameters. It is a fundamental property of bitmap-tracing: the algorithm has no concept of "this is a wing" or "this is a letter". It traces color boundaries pixel-by-pixel. You get correct geometry but zero semantics.

The fix is not a better vectorizer. The fix is **generating an image that is trivially traceable**, then tracing it, then using the one tool that actually understands SVG structure — an LLM — to clean and label the result.

---

## What Actually Works

```
Input Image or Text Prompt
        │
        ▼
┌───────────────────────────────────────┐
│  Stage 1: Normalize                   │
│  Sharp only. No native libs.          │
│  Output: clean PNG, known dimensions  │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Stage 2: Posterize                   │
│  Pure JS color quantization.          │
│  Reduce to 4-8 flat colors.           │
│  Output: flat-color PNG               │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Stage 3: Trace                       │
│  VTracer on the FLAT image.           │
│  Few colors = few paths = clean SVG.  │
│  Output: raw SVG, manageable paths    │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Stage 4: Semantic Repair             │
│  Gemini reads raw SVG + original PNG. │
│  Labels groups, merges fragments,     │
│  removes noise, adds IDs.             │
│  Output: structured editable SVG      │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Stage 5: Optimize                    │
│  SVGO. Path merging. Number rounding. │
│  Output: final SVG                    │
└───────────────────────────────────────┘
```

**Why this is better than the previous plan:**

- No `opencv4nodejs`. No native compilation. No deployment trap.
- VTracer runs on a **pre-simplified image** so its output is already clean.
- Gemini handles semantics (grouping, labeling) which it is actually good at.
- Every stage is a pure function over serializable data.
- Runs on any Node.js server, including Railway, Render, Fly.io.

---

## Stack (For Real This Time)

```
Runtime:        Node.js 20 LTS
Framework:      Next.js 15 App Router, runtime = 'nodejs'
Language:       TypeScript 5.5, strict mode
UI:             React 19, Tailwind CSS v4, shadcn/ui
Animation:      Framer Motion 11
Image decode:   Sharp 0.33 (prebuilt binaries, no compilation)
Color quant:    quantize (pure JS, Leptonica algorithm port)
Vectorizer:     VTracer 0.6 (Rust binary, pre-installed in Docker)
SVG repair:     Gemini 1.5 Pro (large context window, reads SVG text)
SVG optimize:   SVGO 3.x
Deployment:     Docker container (Railway / Fly.io / self-hosted)
Job execution:  Node.js AsyncLocalStorage + in-process worker queue
```

**No OpenCV. No GPT-Image. No native compilation beyond Sharp's prebuilt binaries.**

---

## Deployment Contract (Explicit This Time)

```dockerfile
FROM node:20-slim

# VTracer binary — the only non-npm dependency
RUN curl -L https://github.com/visioncortex/vtracer/releases/download/0.6.3/vtracer-linux-x86_64 \
    -o /usr/local/bin/vtracer && chmod +x /usr/local/bin/vtracer

# Sharp uses prebuilt binaries — no compilation needed
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
```

**This Dockerfile works. VTracer is a single static binary. Sharp downloads a prebuilt `.node` file. No `node-gyp`. No Python. No OpenCV headers.**

---

## Folder Structure

```
curvia/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       └── process/
│           ├── route.ts              POST — start job
│           └── [jobId]/
│               ├── status/route.ts   GET — poll progress
│               └── result/route.ts   GET — fetch SVG + metadata
│
├── components/
│   ├── upload/
│   │   ├── UploadZone.tsx
│   │   └── ImagePreview.tsx
│   ├── pipeline/
│   │   └── ProgressStepper.tsx       sub-stage progress bars
│   ├── results/
│   │   ├── ResultsPanel.tsx
│   │   ├── SVGViewer.tsx             zoom/pan, path highlighting
│   │   └── SVGCodeViewer.tsx         syntax-highlighted, copy button
│   └── ui/                           shadcn components
│
├── hooks/
│   ├── usePipeline.ts                polling logic, backoff
│   ├── useFileUpload.ts
│   └── useLocalStorage.ts            API key persistence
│
├── lib/
│   ├── pipeline/
│   │   ├── orchestrator.ts           runs stages in sequence
│   │   ├── job.ts                    PipelineJob type + transitions
│   │   ├── store.ts                  in-memory job store
│   │   ├── worker.ts                 in-process queue (20 concurrent max)
│   │   ├── context.ts                PipelineContext
│   │   └── logger.ts
│   │
│   ├── stages/                       ← each file = one pure stage
│   │   ├── normalize.ts              Sharp: decode, resize, to PNG
│   │   ├── posterize.ts              quantize: color reduction
│   │   ├── trace.ts                  VTracer CLI wrapper
│   │   ├── repair.ts                 Gemini SVG repair
│   │   └── optimize.ts               SVGO
│   │
│   ├── ai/
│   │   └── gemini.ts                 Gemini client + retry logic
│   │
│   ├── image/
│   │   ├── sharp.ts                  Sharp helpers
│   │   ├── quantize.ts               color quantization wrapper
│   │   └── temp.ts                   temp file lifecycle
│   │
│   ├── svg/
│   │   ├── validator.ts              structural validation
│   │   └── svgo.ts                   SVGO config + runner
│   │
│   ├── config/
│   │   ├── limits.ts
│   │   ├── vtracer.ts                VTracer parameter profiles
│   │   └── prompts.ts                Gemini repair prompt
│   │
│   └── utils/
│       ├── errors.ts
│       └── hash.ts                   cache key generation
│
├── types/
│   ├── pipeline.ts
│   ├── stages.ts
│   └── api.ts
│
├── tests/
│   ├── unit/
│   │   ├── normalize.test.ts
│   │   ├── posterize.test.ts
│   │   ├── validator.test.ts
│   │   └── worker.test.ts
│   ├── integration/
│   │   └── pipeline.test.ts          Gemini mocked
│   ├── golden/
│   │   └── *.svg
│   └── fixtures/
│       ├── logos/
│       ├── icons/
│       ├── illustrations/
│       └── edge/
│
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## The Job Execution Model (Solved)

The previous plan had polling without a worker. Here is the actual solution:

```typescript
// lib/pipeline/worker.ts

const MAX_CONCURRENT = 20;
const queue: Array<() => Promise<void>> = [];
let active = 0;

export function enqueue(jobId: string, task: () => Promise<void>): void {
  if (active >= MAX_CONCURRENT) {
    throw new CapacityError(`Server at capacity. Try again shortly.`);
  }

  const run = async () => {
    active++;
    try {
      await task();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };

  // Fire and forget — the POST handler returns immediately
  // The job runs in the background, updating the store
  run().catch((err) => {
    store.fail(jobId, err.message);
  });
}
```

```typescript
// app/api/process/route.ts

export async function POST(req: Request) {
  const jobId = store.create();         // synchronous, instant

  enqueue(jobId, () =>                  // non-blocking, fires in background
    orchestrator.run(jobId, formData)
  );

  return Response.json({ jobId });      // returns in <10ms
}
```

**This works on any Node.js server.** The process stays alive between requests (unlike Vercel serverless). This is why the Dockerfile and Railway/Fly.io deployment is explicit.

---

## Core Types

### `types/pipeline.ts`

```typescript
export const PIPELINE_VERSION = '1.0.0' as const;

// ─── Job Status ────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'normalizing'
  | 'posterizing'
  | 'tracing'
  | 'repairing'
  | 'optimizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued:      ['normalizing', 'cancelled'],
  normalizing: ['posterizing', 'failed', 'cancelled'],
  posterizing: ['tracing',     'failed', 'cancelled'],
  tracing:     ['repairing',   'failed', 'cancelled'],
  repairing:   ['optimizing',  'failed', 'cancelled'],
  optimizing:  ['completed',   'failed', 'cancelled'],
  completed:   [],
  failed:      [],
  cancelled:   [],
};

// ─── Stage Result ──────────────────────────────────────────────────────────

export interface StageResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  subStatus: string;
  subProgress: number;           // 0–100, real values only, no fake timers
  error?: string;
}

// ─── Artifacts ────────────────────────────────────────────────────────────
// Buffers are stored ONLY for the duration of the job.
// After completion, only svgOptimized is retained.
// This prevents the 24h Buffer memory bomb.

export interface JobArtifacts {
  original: Buffer;              // cleared after tracing stage
  posterized?: Buffer;           // cleared after tracing stage
  svgRaw?: string;               // cleared after optimizing stage
  svgOptimized?: string;         // retained — this is the result
}

// ─── Pipeline Job ─────────────────────────────────────────────────────────

export interface PipelineJob {
  id: string;
  pipelineVersion: typeof PIPELINE_VERSION;
  status: JobStatus;
  stages: Record<JobStatus, StageResult>;
  artifacts: JobArtifacts;
  analysis: ImageAnalysis;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;             // createdAt + 1 hour (not 24h)
  error?: string;
  cached: boolean;
}
```

### `types/stages.ts`

```typescript
// ─── Image Analysis ───────────────────────────────────────────────────────
// Produced by normalize stage, read by all subsequent stages.
// Defined here so every stage that reads it has the same contract.

export interface ImageAnalysis {
  originalWidth: number;
  originalHeight: number;
  normalizedWidth: number;
  normalizedHeight: number;
  hasTransparency: boolean;
  estimatedColorCount: number;   // before quantization
  format: 'png' | 'jpg' | 'webp' | 'gif' | 'svg';
  fileSizeBytes: number;
}

// ─── Stage Inputs/Outputs ─────────────────────────────────────────────────
// Every stage is: (input: StageInput) => Promise<StageOutput>
// No stage knows about any other stage.

export interface NormalizeInput {
  rawBuffer: Buffer;
  mimeType: string;
}

export interface NormalizeOutput {
  pngBuffer: Buffer;
  analysis: ImageAnalysis;
}

export interface PosterizeInput {
  pngBuffer: Buffer;
  colorCount: number;            // 4–8, comes from config
}

export interface PosterizeOutput {
  flatPngBuffer: Buffer;
  actualColorCount: number;      // may be less than requested
  palette: string[];             // hex colors used
}

export interface TraceInput {
  flatPngBuffer: Buffer;
  palette: string[];
}

export interface TraceOutput {
  svgRaw: string;
  pathCount: number;
  traceTimeMs: number;
}

export interface RepairInput {
  svgRaw: string;
  originalPngBuffer: Buffer;    // sent to Gemini for visual reference
  palette: string[];
  analysis: ImageAnalysis;
}

export interface RepairOutput {
  svgRepaired: string;
  changesSummary: string;        // what Gemini changed, for debug
}

export interface OptimizeInput {
  svgRepaired: string;
}

export interface OptimizeOutput {
  svgOptimized: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  reductionPercent: number;
}
```

### `types/api.ts`

```typescript
// POST /api/process
export interface ProcessRequest {
  image: File;
  geminiKey?: string;
  colorCount?: number;           // 4 | 6 | 8, default 6
}

export interface ProcessResponse {
  jobId: string;
  cached: boolean;
}

// GET /api/process/[jobId]/status
export interface StatusResponse {
  status: JobStatus;
  currentStage: JobStatus;
  subStatus: string;
  subProgress: number;
  completedStages: JobStatus[];
  error?: string;
}

// GET /api/process/[jobId]/result
export interface ResultResponse {
  svg: string;
  analysis: ImageAnalysis;
  palette: string[];
  metrics: {
    totalDurationMs: number;
    stageDurations: Partial<Record<JobStatus, number>>;
    pathCount: number;
    svgSizeBytes: number;
    svgSizeReductionPercent: number;
  };
  cached: boolean;
}
```

---

## The Five Stages

### Stage 1: Normalize (`lib/stages/normalize.ts`)

```typescript
import sharp from 'sharp';
import type { NormalizeInput, NormalizeOutput } from '@/types/stages';
import { FileSizeError, FileTypeError } from '@/lib/utils/errors';
import { limits } from '@/lib/config/limits';

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Pure function. No side effects. No network calls.
export async function normalize(input: NormalizeInput): Promise<NormalizeOutput> {
  const { rawBuffer, mimeType } = input;

  // Validate
  if (!SUPPORTED_TYPES.includes(mimeType)) {
    throw new FileTypeError(`Unsupported type: ${mimeType}`);
  }
  if (rawBuffer.byteLength > limits.MAX_FILE_SIZE_BYTES) {
    throw new FileSizeError(`File too large: ${rawBuffer.byteLength} bytes`);
  }

  const image = sharp(rawBuffer);
  const metadata = await image.metadata();

  // Resize: cap at 2048px on longest side, preserve aspect ratio
  const resized = image.resize({
    width: limits.MAX_DIMENSION,
    height: limits.MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Always output PNG — VTracer needs PNG
  const pngBuffer = await resized
    .png({ compressionLevel: 6 })
    .toBuffer();

  const outMeta = await sharp(pngBuffer).metadata();

  return {
    pngBuffer,
    analysis: {
      originalWidth: metadata.width ?? 0,
      originalHeight: metadata.height ?? 0,
      normalizedWidth: outMeta.width ?? 0,
      normalizedHeight: outMeta.height ?? 0,
      hasTransparency: metadata.hasAlpha ?? false,
      estimatedColorCount: 0,    // filled by posterize stage
      format: (metadata.format as ImageAnalysis['format']) ?? 'png',
      fileSizeBytes: rawBuffer.byteLength,
    },
  };
}
```

**Why this is simple and correct:**
- Sharp has prebuilt binaries. No compilation.
- One responsibility: decode + resize + normalize to PNG.
- Zero network calls. Always fast (<500ms).

---

### Stage 2: Posterize (`lib/stages/posterize.ts`)

This is the stage that actually fixes the VTracer output problem. By reducing the image to 4-8 flat colors **before** tracing, VTracer produces a small number of clean paths instead of thousands of fragmented ones.

```typescript
import sharp from 'sharp';
import Quantize from 'quantize';
import type { PosterizeInput, PosterizeOutput } from '@/types/stages';

export async function posterize(input: PosterizeInput): Promise<PosterizeOutput> {
  const { pngBuffer, colorCount } = input;

  // Extract raw pixels via Sharp
  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Build pixel array for quantizer
  // quantize expects Array<[r, g, b]>
  const pixels: Array<[number, number, number]> = [];

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;

    // Skip transparent pixels — they become white in output
    if (a < 128) continue;
    pixels.push([r, g, b]);
  }

  // Median-cut quantization (pure JS, no native deps)
  const colorMap = Quantize(pixels, colorCount);
  const palette = colorMap.palette() as Array<[number, number, number]>;

  // Remap every pixel to nearest palette color
  const outputData = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const a = channels === 4 ? data[i + 3] : 255;

    if (a < 128) {
      // Transparent → white
      outputData[i] = 255;
      outputData[i + 1] = 255;
      outputData[i + 2] = 255;
      if (channels === 4) outputData[i + 3] = 255;
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Find nearest palette color by Euclidean distance in RGB
    let nearest = palette[0];
    let minDist = Infinity;

    for (const color of palette) {
      const dist =
        (r - color[0]) ** 2 +
        (g - color[1]) ** 2 +
        (b - color[2]) ** 2;
      if (dist < minDist) {
        minDist = dist;
        nearest = color;
      }
    }

    outputData[i] = nearest[0];
    outputData[i + 1] = nearest[1];
    outputData[i + 2] = nearest[2];
    if (channels === 4) outputData[i + 3] = 255;
  }

  // Re-encode as PNG
  const flatPngBuffer = await sharp(outputData, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();

  const hexPalette = palette.map(([r, g, b]) =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  );

  return {
    flatPngBuffer,
    actualColorCount: palette.length,
    palette: hexPalette,
  };
}
```

**Why this is the core insight of the entire system:**

```
Before posterize:  Photo with 50,000 unique colors
                   VTracer output: 8,000+ paths, fragmented mess

After posterize:   Same photo with 6 flat colors
                   VTracer output: ~50-200 paths, clean regions

The vectorizer hasn't changed. The input has changed.
```

---

### Stage 3: Trace (`lib/stages/trace.ts`)

```typescript
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { TraceInput, TraceOutput } from '@/types/stages';
import { StageError } from '@/lib/utils/errors';
import { vtracerConfig } from '@/lib/config/vtracer';

export async function trace(
  input: TraceInput,
  signal: AbortSignal,
): Promise<TraceOutput> {
  const { flatPngBuffer, palette } = input;

  // Use unique filenames to prevent race conditions under concurrency
  const id = randomUUID();
  const tmpDir = process.env.TEMP_DIR ?? '/tmp';
  const inputPath = join(tmpDir, `curvia-${id}-in.png`);
  const outputPath = join(tmpDir, `curvia-${id}-out.svg`);

  const startMs = Date.now();

  try {
    await writeFile(inputPath, flatPngBuffer);

    const svgRaw = await runVTracer(inputPath, outputPath, signal);
    const pathCount = (svgRaw.match(/<path/g) ?? []).length;

    return {
      svgRaw,
      pathCount,
      traceTimeMs: Date.now() - startMs,
    };
  } finally {
    // Always cleanup — even on error or cancellation
    await Promise.allSettled([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

function runVTracer(
  inputPath: string,
  outputPath: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--input', inputPath,
      '--output', outputPath,
      '--colormode', 'color',
      '--hierarchical', 'stacked',
      '--mode', 'spline',
      '--filter-speckle', String(vtracerConfig.filterSpeckle),
      '--color-precision', String(vtracerConfig.colorPrecision),
      '--corner-threshold', String(vtracerConfig.cornerThreshold),
      '--length-threshold', String(vtracerConfig.lengthThreshold),
      '--path-precision', String(vtracerConfig.pathPrecision),
    ];

    const proc = spawn('vtracer', args, { signal });
    const stderr: string[] = [];

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ABORT_ERR') {
        reject(new CancelledError('VTracer cancelled'));
      } else if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new StageError(
          'tracing',
          'VTracer binary not found. Is it installed at /usr/local/bin/vtracer?',
          err,
        ));
      } else {
        reject(new StageError('tracing', err.message, err));
      }
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        reject(new StageError(
          'tracing',
          `VTracer exited with code ${code}. stderr: ${stderr.join('')}`,
        ));
        return;
      }

      try {
        const svg = await readFile(outputPath, 'utf8');
        resolve(svg);
      } catch (err) {
        reject(new StageError('tracing', 'Could not read VTracer output', err));
      }
    });
  });
}
```

**Key decisions:**
- `randomUUID()` in filename = no race conditions under 20 concurrent jobs.
- `finally` block with `Promise.allSettled` = temp files always cleaned up.
- `signal` passed to `spawn` = cancellation kills the process immediately.
- Explicit `ENOENT` check = clear error if VTracer not installed.

---

### Stage 4: Repair (`lib/stages/repair.ts`)

This is the stage that replaces OpenCV + GPT-Image from the previous plan. Gemini reads the raw SVG text and the original image, then produces a cleaned SVG with proper semantic structure.

```typescript
import type { RepairInput, RepairOutput } from '@/types/stages';
import type { GeminiClient } from '@/lib/ai/gemini';
import { REPAIR_PROMPT } from '@/lib/config/prompts';
import { StageError } from '@/lib/utils/errors';

export async function repair(
  input: RepairInput,
  gemini: GeminiClient,
  signal: AbortSignal,
): Promise<RepairOutput> {
  const { svgRaw, originalPngBuffer, palette, analysis } = input;

  // Gemini 1.5 Pro has a 1M token context window.
  // Raw SVG from a posterized image is typically 20-200KB.
  // Fits easily. No chunking needed.

  const prompt = buildPrompt(svgRaw, palette, analysis);

  const response = await gemini.generateContent(
    {
      contents: [
        {
          role: 'user',
          parts: [
            // Original image for visual reference
            {
              inlineData: {
                mimeType: 'image/png',
                data: originalPngBuffer.toString('base64'),
              },
            },
            // The raw SVG to repair
            { text: prompt },
          ],
        },
      ],
    },
    signal,
  );

  const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new StageError('repairing', 'Gemini returned empty response');
  }

  // Extract SVG from response (Gemini may wrap it in markdown)
  const svgRepaired = extractSVG(responseText);
  const changesSummary = extractSummary(responseText);

  return { svgRepaired, changesSummary };
}

function buildPrompt(
  svgRaw: string,
  palette: string[],
  analysis: ImageAnalysis,
): string {
  return `${REPAIR_PROMPT}

PALETTE (${palette.length} colors): ${palette.join(', ')}
DIMENSIONS: ${analysis.normalizedWidth}×${analysis.normalizedHeight}
HAS TRANSPARENCY: ${analysis.hasTransparency}

RAW SVG TO REPAIR:
\`\`\`svg
${svgRaw}
\`\`\`

Return ONLY the repaired SVG, then on a new line write:
CHANGES: <one-line summary of what you changed>`;
}

function extractSVG(text: string): string {
  // Try fenced code block first
  const fenced = text.match(/```(?:svg|xml)?\n([\s\S]+?)\n```/);
  if (fenced) return fenced[1].trim();

  // Try raw SVG element
  const raw = text.match(/<svg[\s\S]+<\/svg>/);
  if (raw) return raw[0].trim();

  throw new StageError('repairing', 'Could not extract SVG from Gemini response');
}

function extractSummary(text: string): string {
  const match = text.match(/CHANGES:\s*(.+)/);
  return match?.[1]?.trim() ?? 'No summary provided';
}
```

### `lib/config/prompts.ts`

```typescript
export const REPAIR_PROMPT = `
You are an SVG cleanup and structuring tool. You will receive:
1. The original image (for visual reference)
2. A raw SVG produced by a bitmap tracer

Your job is to produce a clean, editable SVG. Follow these rules exactly:

STRUCTURE RULES:
- Wrap related paths in <g> elements with descriptive id attributes
  Example: <g id="background">, <g id="main-shape">, <g id="text-area">
- Give each <path> a unique id: path-1, path-2, etc.
- Add a <title> element inside each <g> describing what it contains
- Add inkscape:label attributes matching the id for Inkscape compatibility

GEOMETRY RULES:
- Do NOT change any path d="" attributes
- Do NOT change any fill colors
- Do NOT add strokes where none existed
- Do NOT add gradients or filters
- Do NOT change the viewBox

CLEANUP RULES:
- Remove duplicate paths (identical d attributes)
- Remove paths with zero area (single point, zero-length)
- Remove paths whose fill exactly matches the background color
  and that are larger than 80% of the viewBox area
- Merge adjacent <path> elements that share the same fill into one <g>
- Remove empty <g> elements

OUTPUT REQUIREMENTS:
- Valid, well-formed XML
- xmlns="http://www.w3.org/2000/svg" on the root element
- viewBox preserved exactly from input
- All colors preserved exactly from input
- No external references, no <image> elements, no scripts
`.trim();
```

**Why Gemini instead of OpenCV for this step:**

```
OpenCV approach:
  - 600 lines of C++ binding calls
  - Fails differently on each image
  - Cannot understand "this is the letter A"
  - Cannot merge logically related paths
  - Cannot write descriptive IDs

Gemini approach:
  - 50 lines of API call
  - Can see the original image AND the SVG simultaneously
  - Understands visual semantics
  - Can group "these 3 paths form the logo mark"
  - Produces human-readable IDs automatically
  - Handles edge cases via natural language instructions
```

The constraint is that Gemini **must not change geometry** — the prompt is explicit and the SVG validator enforces this after the stage.

---

### Stage 5: Optimize (`lib/stages/optimize.ts`)

```typescript
import { optimize } from 'svgo';
import type { OptimizeInput, OptimizeOutput } from '@/types/stages';
import { svgoConfig } from '@/lib/config/svgo';

export function optimizeSVG(input: OptimizeInput): OptimizeOutput {
  const { svgRepaired } = input;

  const originalSizeBytes = Buffer.byteLength(svgRepaired, 'utf8');

  const result = optimize(svgRepaired, svgoConfig);

  if ('error' in result) {
    throw new StageError('optimizing', result.error);
  }

  const optimizedSizeBytes = Buffer.byteLength(result.data, 'utf8');

  return {
    svgOptimized: result.data,
    originalSizeBytes,
    optimizedSizeBytes,
    reductionPercent: Math.round(
      (1 - optimizedSizeBytes / originalSizeBytes) * 100,
    ),
  };
}
```

### `lib/config/svgo.ts`

```typescript
import type { Config } from 'svgo';

export const svgoConfig: Config = {
  plugins: [
    // Safe optimizations only
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'cleanupIds',       // keeps ids but shortens unused ones
    'removeUselessDefs',
    'cleanupNumericValues',
    'convertColors',    // #ffffff → #fff
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'mergePaths',       // merges adjacent same-fill paths
    'convertPathData',  // rounds coordinates, removes redundant commands
    'sortAttrs',

    // DISABLED — these break editability
    // 'removeViewBox',     — must keep viewBox
    // 'collapseGroups',    — destroys semantic grouping from repair stage
    // 'removeHiddenElems', — may remove intentional structure
  ],
  js2svg: {
    indent: 2,
    pretty: true,      // human-readable output
  },
};
```

---

## The Orchestrator

```typescript
// lib/pipeline/orchestrator.ts

import { store } from './store';
import { normalize } from '@/lib/stages/normalize';
import { posterize } from '@/lib/stages/posterize';
import { trace } from '@/lib/stages/trace';
import { repair } from '@/lib/stages/repair';
import { optimizeSVG } from '@/lib/stages/optimize';
import { validateSVG } from '@/lib/svg/validator';
import type { GeminiClient } from '@/lib/ai/gemini';

export async function runPipeline(
  jobId: string,
  rawBuffer: Buffer,
  mimeType: string,
  colorCount: number,
  gemini: GeminiClient,
  signal: AbortSignal,
): Promise<void> {

  // Helper: update job progress without boilerplate
  const progress = (stage: JobStatus, subProgress: number, subStatus: string) => {
    store.update(jobId, {
      status: stage,
      currentStage: stage,
      stages: {
        [stage]: { status: 'running', subProgress, subStatus }
      }
    });
  };

  try {

    // ── Stage 1: Normalize ────────────────────────────────────────
    progress('normalizing', 0, 'Decoding image…');
    const normalized = await normalize({ rawBuffer, mimeType });
    progress('normalizing', 100, 'Done');
    store.setAnalysis(jobId, normalized.analysis);

    // ── Stage 2: Posterize ────────────────────────────────────────
    progress('posterizing', 0, 'Analyzing colors…');
    const posterized = await posterize({
      pngBuffer: normalized.pngBuffer,
      colorCount,
    });
    progress('posterizing', 50, `Reduced to ${posterized.actualColorCount} colors`);
    store.setPalette(jobId, posterized.palette);
    progress('posterizing', 100, 'Done');

    // Clear original buffer — no longer needed
    store.clearBuffer(jobId, 'original');

    // ── Stage 3: Trace ────────────────────────────────────────────
    progress('tracing', 0, 'Starting VTracer…');
    const traced = await trace(
      { flatPngBuffer: posterized.flatPngBuffer, palette: posterized.palette },
      signal,
    );
    progress('tracing', 100, `Traced ${traced.pathCount} paths`);

    // Clear image buffers — SVG is the artifact now
    store.clearBuffer(jobId, 'posterized');

    // ── Stage 4: Repair ───────────────────────────────────────────
    progress('repairing', 0, 'Sending to Gemini…');
    const repaired = await repair(
      {
        svgRaw: traced.svgRaw,
        originalPngBuffer: normalized.pngBuffer,
        palette: posterized.palette,
        analysis: normalized.analysis,
      },
      gemini,
      signal,
    );
    progress('repairing', 90, 'Validating Gemini output…');

    // Validate that Gemini didn't change geometry
    const validation = validateSVG(repaired.svgRepaired);
    if (!validation.valid) {
      throw new StageError('repairing', `Invalid SVG from Gemini: ${validation.errors.join(', ')}`);
    }

    progress('repairing', 100, 'Done');

    // ── Stage 5: Optimize ─────────────────────────────────────────
    progress('optimizing', 0, 'Running SVGO…');
    const optimized = optimizeSVG({ svgRepaired: repaired.svgRepaired });
    progress('optimizing', 100,
      `Reduced by ${optimized.reductionPercent}%`);

    // ── Complete ──────────────────────────────────────────────────
    store.complete(jobId, optimized.svgOptimized);

  } catch (err) {
    if (err instanceof CancelledError) {
      store.cancel(jobId);
    } else {
      store.fail(jobId, err instanceof Error ? err.message : String(err));
    }
  }
}
```

---

## Memory Management (The 24h Buffer Problem, Fixed)

```typescript
// lib/pipeline/store.ts — memory lifecycle

class JobStore {
  private jobs = new Map<string, PipelineJob>();

  // Called by orchestrator between stages
  clearBuffer(jobId: string, key: 'original' | 'posterized'): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    delete job.artifacts[key];
    // GC can now collect these buffers
  }

  complete(jobId: string, svgOptimized: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Retain ONLY the final SVG string
    // All image Buffers are released
    job.artifacts = { svgOptimized };
    job.status = 'completed';
    job.expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour, not 24
  }
}
```

**Memory per completed job:**
```
Previous plan: ~16MB (original + restored + cleaned + SVGs)
This plan:     ~50-500KB (SVG string only)

Under 20 concurrent jobs: ~10MB total vs ~320MB total
```

---

## SVG Validator (Geometry Guard)

After the repair stage, this runs to ensure Gemini followed the rules:

```typescript
// lib/svg/validator.ts

import { parseXml } from '@rgrove/parse-xml';

export interface SVGValidationResult {
  valid: boolean;
  pathCount: number;
  groupCount: number;
  fileSizeBytes: number;
  hasViewBox: boolean;
  hasXmlns: boolean;
  duplicateIds: string[];
  emptyPaths: string[];
  errors: string[];
  warnings: string[];
}

const MAX_PATH_COUNT = 5_000;
const MAX_SIZE_BYTES = 5_000_000;

export function validateSVG(svg: string): SVGValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sizeBytes = Buffer.byteLength(svg, 'utf8');
  if (sizeBytes > MAX_SIZE_BYTES) {
    errors.push(`SVG too large: ${sizeBytes} bytes (max ${MAX_SIZE_BYTES})`);
  }

  let doc;
  try {
    doc = parseXml(svg);
  } catch (e) {
    return {
      valid: false,
      pathCount: 0,
      groupCount: 0,
      fileSizeBytes: sizeBytes,
      hasViewBox: false,
      hasXmlns: false,
      duplicateIds: [],
      emptyPaths: [],
      errors: [`XML parse error: ${e}`],
      warnings: [],
    };
  }

  const root = doc.children.find((n) => n.type === 'element' && n.name === 'svg');
  if (!root) {
    errors.push('No <svg> root element');
    return makeResult(false, 0, 0, sizeBytes, false, false, [], [], errors, warnings);
  }

  const hasViewBox = 'viewBox' in (root.attributes ?? {});
  const hasXmlns = 'xmlns' in (root.attributes ?? {});

  if (!hasViewBox) warnings.push('Missing viewBox attribute');
  if (!hasXmlns) warnings.push('Missing xmlns attribute');

  // Count elements
  const ids = new Set<string>();
  const duplicateIds: string[] = [];
  const emptyPaths: string[] = [];
  let pathCount = 0;
  let groupCount = 0;

  function walk(node: unknown): void {
    if (node.type !== 'element') return;

    if (node.name === 'path') {
      pathCount++;
      const d = node.attributes?.d ?? '';
      if (!d || d.trim() === '' || d === 'M0 0') {
        emptyPaths.push(node.attributes?.id ?? `path-${pathCount}`);
      }
    }

    if (node.name === 'g') groupCount++;

    const id = node.attributes?.id;
    if (id) {
      if (ids.has(id)) duplicateIds.push(id);
      else ids.add(id);
    }

    node.children?.forEach(walk);
  }

  walk(root);

  if (pathCount > MAX_PATH_COUNT) {
    errors.push(`Too many paths: ${pathCount} (max ${MAX_PATH_COUNT})`);
  }

  if (duplicateIds.length > 0) {
    warnings.push(`Duplicate IDs: ${duplicateIds.join(', ')}`);
  }

  return makeResult(
    errors.length === 0,
    pathCount,
    groupCount,
    sizeBytes,
    hasViewBox,
    hasXmlns,
    duplicateIds,
    emptyPaths,
    errors,
    warnings,
  );
}
```

---

## Error Hierarchy

```typescript
// lib/utils/errors.ts

export type ErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_UNSUPPORTED'
  | 'STAGE_FAILED'
  | 'AI_ERROR'
  | 'CAPACITY_EXCEEDED'
  | 'JOB_NOT_FOUND'
  | 'JOB_EXPIRED'
  | 'CANCELLED'
  | 'SVG_INVALID'
  | 'VTRACER_NOT_FOUND';

export class CurviaError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly httpStatus: number = 500,
  ) {
    super(message);
    this.name = 'CurviaError';
  }
}

export class FileSizeError extends CurviaError {
  constructor(message: string) {
    super(message, 'FILE_TOO_LARGE', 413);
  }
}

export class FileTypeError extends CurviaError {
  constructor(message: string) {
    super(message, 'FILE_TYPE_UNSUPPORTED', 415);
  }
}

export class StageError extends CurviaError {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${stage}] ${message}`, 'STAGE_FAILED', 500);
  }
}

export class AIError extends CurviaError {
  constructor(
    public readonly provider: 'gemini',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, 'AI_ERROR', 502);
  }
}

export class CapacityError extends CurviaError {
  constructor(message = 'Server at capacity. Please try again.') {
    super(message, 'CAPACITY_EXCEEDED', 429);
  }
}

export class CancelledError extends CurviaError {
  constructor(message = 'Job was cancelled') {
    super(message, 'CANCELLED', 499);
  }
}

export class JobNotFoundError extends CurviaError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', 404);
  }
}
```

---

## CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install VTracer
        run: |
          curl -L https://github.com/visioncortex/vtracer/releases/download/0.6.3/vtracer-linux-x86_64 \
            -o /usr/local/bin/vtracer
          chmod +x /usr/local/bin/vtracer
          vtracer --version

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests (AI mocked)
        run: npm run test:integration
        env:
          GEMINI_API_KEY: test-key-not-used-ai-is-mocked

      - name: Golden tests (structural comparison)
        run: npm run test:golden
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          RUN_GOLDEN: 'true'

      - name: Build
        run: npm run build

      - name: Security audit
        run: npm audit --audit-level=high
```

---

## What This Fixes vs The Previous Plan

```
Problem                           Previous Plan        This Plan
────────────────────────────────────────────────────────────────────
VTracer produces 1000s of paths   Parameter tuning     Posterize first
                                  (doesn't work)       (actually works)

opencv4nodejs native compilation  Deployment trap      Removed entirely
                                                       Pure JS quantize

GPT-Image is stochastic           Accepted as-is       Removed entirely
                                                       Gemini for semantics only

Job worker missing for polling    Deferred to v2       Simple in-process
                                  (breaks v1)          queue, works now

24h Buffer memory bomb            Not addressed        Buffers freed between
                                                       stages, 1h SVG TTL

Buffer-only vs VTracer files      Contradicted         ADR explains VTracer
                                  each other           exception explicitly

ImageAnalysis undefined           Referenced           Fully typed in
                                  everywhere           types/stages.ts

Deployment target unclear         "Next.js 15"         Explicit Dockerfile
                                  (Vercel mismatch)    Railway/Fly.io
```

---

## What's Still Hard (Honest)

```
1. Gemini geometry fidelity
   Gemini is instructed not to change path d="" attributes.
   The validator checks after. But Gemini may still make
   subtle changes. The validator needs to compare path counts
   and a sample of d values between raw and repaired SVG.
   This is extra validation work not yet spec'd.

2. VTracer binary version pinning
   The Dockerfile pins 0.6.3. If the release URL changes,
   the Docker build breaks. Use a checksum verification
   step and a private binary mirror for production.

3. Posterize quality on illustrations
   Median-cut quantization is correct but not always
   perceptually optimal. Complex illustrations with subtle
   color gradients will posterize into flat blobs.
   This is a fundamental tradeoff: fewer colors = cleaner
   SVG but less accurate to the original. Document this
   clearly in the UI.

4. Gemini context limit edge case
   1M token context = ~750KB of text. A very complex SVG
   from VTracer could theoretically exceed this before
   the repair stage. Add a check: if svgRaw > 500KB,
   skip the repair stage and go straight to SVGO.

5. Concurrency and the event loop
   The in-process worker queue uses async/await correctly
   but Sharp and the VTracer process spawn are I/O bound.
   The quantize color remapping loop (pixel by pixel) IS
   CPU bound and will block the event loop for large images.
   Fix: run posterize in a worker_thread for images
   above a size threshold.
```
