import { AIError } from '@/lib/utils/errors';

// OpenAI-compatible image endpoints on Pollinations' unified gateway.
// Docs: https://gen.pollinations.ai/docs (APIDOCS.md in pollinations/pollinations).
const POLLINATIONS_BASE = 'https://gen.pollinations.ai';
const GENERATE_ENDPOINT = `${POLLINATIONS_BASE}/v1/images/generations`;
const EDIT_ENDPOINT = `${POLLINATIONS_BASE}/v1/images/edits`;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

interface CreateImageResponseData {
  b64_json?: string;
  url?: string;
}

interface CreateImageResponse {
  data?: CreateImageResponseData[];
}

export interface PollinationsGenerateOptions {
  /** Image model. Default 'flux' per plan.md's text-to-image feature. */
  model?: string;
  /** WIDTHxHEIGHT, default matches Pollinations' own default. */
  size?: string;
}

export interface PollinationsEditOptions {
  /** Image-edit model. Default 'gptimage' per plan.md's image-to-image feature. */
  model?: string;
}

/** Thin client around Pollinations' OpenAI-compatible image endpoints, with
 *  exponential-backoff retry on transient (5xx/429) failures. Mirrors
 *  GeminiClient (lib/ai/gemini.ts) so the two AI integrations behave
 *  consistently from the orchestrator/route layer's point of view. */
export class PollinationsClient {
  constructor(private readonly apiKey: string) {}

  /** Text -> image via POST /v1/images/generations. */
  async generateImage(prompt: string, opts: PollinationsGenerateOptions = {}): Promise<Buffer> {
    const body = JSON.stringify({
      prompt,
      model: opts.model ?? 'flux',
      size: opts.size ?? '1024x1024',
      // Request base64 directly so the server never has to make a second
      // round-trip fetch for the actual image bytes.
      response_format: 'b64_json',
    });

    const json = await this.request(GENERATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    return extractImageBuffer(json);
  }

  /** Image + text -> edited image via POST /v1/images/edits (multipart). */
  async editImage(
    imageBuffer: Buffer,
    imageMimeType: string,
    prompt: string,
    opts: PollinationsEditOptions = {},
  ): Promise<Buffer> {
    const form = new FormData();
    // Buffer is a Uint8Array subclass; wrap in a Blob for the multipart part.
    form.append('image', new Blob([imageBuffer], { type: imageMimeType }), 'input');
    form.append('prompt', prompt);
    form.append('model', opts.model ?? 'gptimage');
    form.append('response_format', 'b64_json');

    const json = await this.request(EDIT_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    return extractImageBuffer(json);
  }

  private async request(url: string, init: RequestInit): Promise<CreateImageResponse> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_RETRIES) {
      try {
        const res = await fetch(url, init);

        if (res.ok) {
          return (await res.json()) as CreateImageResponse;
        }

        // Retry on transient errors only (mirrors GeminiClient).
        if (res.status === 429 || res.status >= 500) {
          lastError = new AIError(
            'pollinations',
            `Pollinations returned ${res.status}`,
            res.status,
          );
          attempt++;
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }

        // Non-retryable (4xx other than 429) — e.g. 401 bad key, 402 out of
        // budget, 400 bad prompt/model.
        const errBody = await res.text();
        throw new AIError('pollinations', `Pollinations error ${res.status}: ${errBody}`, res.status);
      } catch (err) {
        if (err instanceof AIError) throw err;
        lastError = err;
        attempt++;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }

    throw new AIError(
      'pollinations',
      `Pollinations request failed after ${MAX_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      502,
    );
  }
}

async function extractImageBuffer(json: CreateImageResponse): Promise<Buffer> {
  const entry = json.data?.[0];
  if (!entry) {
    throw new AIError('pollinations', 'Pollinations returned no image data', 502);
  }

  if (entry.b64_json) {
    return Buffer.from(entry.b64_json, 'base64');
  }

  // Defensive fallback: response_format=b64_json was requested, but if a
  // future API change (or a model that doesn't honor it) returns a URL
  // instead, fetch it server-side rather than failing outright.
  if (entry.url) {
    const res = await fetch(entry.url);
    if (!res.ok) {
      throw new AIError(
        'pollinations',
        `Failed to fetch generated image from returned URL: ${res.status}`,
        res.status,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new AIError('pollinations', 'Pollinations response contained neither b64_json nor url', 502);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
