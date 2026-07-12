import type { JobStatus } from './pipeline';
import type { ImageAnalysis } from './stages';

// POST /api/process
export interface ProcessRequest {
  image: File;
  geminiKey?: string;
  colorCount?: number; // 4 | 6 | 8, default 6
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
