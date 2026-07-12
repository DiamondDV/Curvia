import { spawn } from 'child_process';
import { writeFile, readFile, unlink, access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { TraceInput, TraceOutput } from '@/types/stages';
import { StageError, CancelledError } from '@/lib/utils/errors';
import { vtracerConfig } from '@/lib/config/vtracer';

// Resolve the VTracer binary robustly:
// 1. Explicit override via VTRACER_PATH (useful for local dev / CI)
// 2. The binary bundled in the repo at bin/vtracer (matches Dockerfile contract)
// 3. Fall back to PATH lookup (production image installs it to /usr/local/bin)
let cachedBinaryPath: string | null = null;

async function resolveVtracerBinary(): Promise<string> {
  if (cachedBinaryPath) return cachedBinaryPath;

  if (process.env.VTRACER_PATH) {
    cachedBinaryPath = process.env.VTRACER_PATH;
    return cachedBinaryPath;
  }

  const bundled = join(process.cwd(), 'bin', 'vtracer');
  try {
    await access(bundled, fsConstants.X_OK);
    cachedBinaryPath = bundled;
    return cachedBinaryPath;
  } catch {
    // not present or not executable, fall through to PATH lookup
  }

  cachedBinaryPath = 'vtracer';
  return cachedBinaryPath;
}

// This VTracer build only writes width/height on the root <svg>, never a
// viewBox. Without a viewBox the output can't scale responsively when
// embedded elsewhere (width:100% CSS etc.) — which defeats the point of
// shipping a vector file. Synthesize one from width/height when absent.
function ensureViewBox(svg: string): string {
  if (/\bviewBox\s*=/.test(svg)) return svg;

  const match = svg.match(/<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
  if (!match) return svg;

  const [, width, height] = match;
  return svg.replace(/<svg\b/, `<svg viewBox="0 0 ${width} ${height}"`);
}

export async function trace(input: TraceInput, signal: AbortSignal): Promise<TraceOutput> {
  const { flatPngBuffer } = input;

  // Use unique filenames to prevent race conditions under concurrency
  const id = randomUUID();
  const tmpDir = process.env.TEMP_DIR ?? '/tmp';
  const inputPath = join(tmpDir, `curvia-${id}-in.png`);
  const outputPath = join(tmpDir, `curvia-${id}-out.svg`);

  const startMs = Date.now();

  try {
    await writeFile(inputPath, flatPngBuffer);

    const rawFromVtracer = await runVTracer(inputPath, outputPath, signal);
    const svgRaw = ensureViewBox(rawFromVtracer);
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

async function runVTracer(inputPath: string, outputPath: string, signal: AbortSignal): Promise<string> {
  const binary = await resolveVtracerBinary();

  return new Promise((resolve, reject) => {
    const args = [
      '--input', inputPath,
      '--output', outputPath,
      '--colormode', 'color',
      '--hierarchical', 'stacked',
      '--mode', 'spline',
      // Note: this VTracer build (0.6.4) uses underscore-separated flag
      // names, not hyphens. `--length-threshold` also doesn't exist on
      // this build; the closest equivalent is `--segment_length`.
      '--filter_speckle', String(vtracerConfig.filterSpeckle),
      '--color_precision', String(vtracerConfig.colorPrecision),
      '--corner_threshold', String(vtracerConfig.cornerThreshold),
      '--segment_length', String(vtracerConfig.lengthThreshold),
      '--path_precision', String(vtracerConfig.pathPrecision),
    ];

    const proc = spawn(binary, args, { signal });
    const stderr: string[] = [];

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    proc.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ABORT_ERR') {
        reject(new CancelledError('VTracer cancelled'));
      } else if (code === 'ENOENT') {
        reject(
          new StageError(
            'tracing',
            `VTracer binary not found at "${binary}". Set VTRACER_PATH or ensure bin/vtracer is present and executable.`,
            err,
          ),
        );
      } else {
        reject(new StageError('tracing', err.message, err));
      }
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        reject(new StageError('tracing', `VTracer exited with code ${code}. stderr: ${stderr.join('')}`));
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
