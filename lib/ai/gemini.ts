import { AIError } from '@/lib/utils/errors';

// gemini-1.5-pro has been retired. Using gemini-2.5-flash — it's the
// non-preview Flash-tier model with the healthiest quota available,
// and still supports multimodal input (image + text) which repair.ts needs.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

// Gemini 2.5 Flash is a "thinking" model — by default it spends part of
// the output token budget on internal reasoning before writing the
// visible response. That's wasted latency/tokens for a deterministic
// cleanup task like SVG repair, and risks truncating the actual SVG
// before it's fully written. Disable it and raise the output cap so a
// large repaired SVG has room to complete.
const GENERATION_CONFIG = {
  maxOutputTokens: 65536,
  thinkingConfig: { thinkingBudget: 0 },
};

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface GeminiContent {
  role: 'user';
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

/**
 * Thin client around the Gemini generateContent REST endpoint, with
 * exponential-backoff retry on transient (5xx/429) failures.
 */
export class GeminiClient {
  constructor(private readonly apiKey: string) {}

  async generateContent(request: GeminiRequest, signal: AbortSignal): Promise<GeminiResponse> {
    let attempt = 0;
    let lastError: unknown;

    const body = JSON.stringify({
      ...request,
      generationConfig: GENERATION_CONFIG,
    });

    while (attempt < MAX_RETRIES) {
      try {
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal,
        });

        if (res.ok) {
          return (await res.json()) as GeminiResponse;
        }

        // Retry on transient errors only
        if (res.status === 429 || res.status >= 500) {
          lastError = new AIError('gemini', `Gemini returned ${res.status}`, res.status);
          attempt++;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }

        // Non-retryable (4xx other than 429)
        const errBody = await res.text();
        throw new AIError('gemini', `Gemini error ${res.status}: ${errBody}`, res.status);
      } catch (err) {
        if (err instanceof AIError) throw err;
        if ((err as { name?: string }).name === 'AbortError') throw err;
        lastError = err;
        attempt++;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }

    throw new AIError(
      'gemini',
      `Gemini request failed after ${MAX_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      502,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
