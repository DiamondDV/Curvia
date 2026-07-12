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
    this.name = 'FileSizeError';
  }
}

export class FileTypeError extends CurviaError {
  constructor(message: string) {
    super(message, 'FILE_TYPE_UNSUPPORTED', 415);
    this.name = 'FileTypeError';
  }
}

export class StageError extends CurviaError {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${stage}] ${message}`, 'STAGE_FAILED', 500);
    this.name = 'StageError';
  }
}

export class AIError extends CurviaError {
  constructor(
    // 'pollinations' added alongside 'gemini' for the text-to-image /
    // image-edit flows (lib/ai/pollinations.ts) — same retry-on-transient
    // pattern as GeminiClient, just a different upstream provider.
    public readonly provider: 'gemini' | 'pollinations',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, 'AI_ERROR', 502);
    this.name = 'AIError';
  }
}

export class CapacityError extends CurviaError {
  constructor(message = 'Server at capacity. Please try again.') {
    super(message, 'CAPACITY_EXCEEDED', 429);
    this.name = 'CapacityError';
  }
}

export class CancelledError extends CurviaError {
  constructor(message = 'Job was cancelled') {
    super(message, 'CANCELLED', 499);
    this.name = 'CancelledError';
  }
}

export class JobNotFoundError extends CurviaError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`, 'JOB_NOT_FOUND', 404);
    this.name = 'JobNotFoundError';
  }
}

export class JobExpiredError extends CurviaError {
  constructor(jobId: string) {
    super(`Job expired: ${jobId}`, 'JOB_EXPIRED', 410);
    this.name = 'JobExpiredError';
  }
}

export class SVGInvalidError extends CurviaError {
  constructor(message: string) {
    super(message, 'SVG_INVALID', 422);
    this.name = 'SVGInvalidError';
  }
}
