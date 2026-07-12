// ─── Image Analysis ────────────────────────────────────────────────────────
// Produced by normalize stage, read by all subsequent stages.

export interface ImageAnalysis {
  originalWidth: number;
  originalHeight: number;
  normalizedWidth: number;
  normalizedHeight: number;
  hasTransparency: boolean;
  estimatedColorCount: number; // before quantization
  format: 'png' | 'jpg' | 'webp' | 'gif' | 'svg';
  fileSizeBytes: number;
}

// ─── Stage Inputs/Outputs ──────────────────────────────────────────────────
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
  colorCount: number; // 4–8, comes from config
}

export interface PosterizeOutput {
  flatPngBuffer: Buffer;
  actualColorCount: number; // may be less than requested
  palette: string[]; // hex colors used
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
  originalPngBuffer: Buffer; // sent to Gemini for visual reference
  palette: string[];
  analysis: ImageAnalysis;
}

export interface RepairOutput {
  svgRepaired: string;
  changesSummary: string; // what Gemini changed, for debug
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
