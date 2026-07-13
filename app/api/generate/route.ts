import { PollinationsClient } from '@/lib/ai/pollinations';
import { enhancePromptForVectorization } from '@/lib/ai/prompt-enhancement';
import { CurviaError } from '@/lib/utils/errors';

export const runtime = 'nodejs';

// Text -> image via Pollinations' 'flux' model. Returns raw image bytes
// (not a job id) — the frontend wraps this into a File and feeds it
// straight into the existing POST /api/process pipeline, same as a manual
// upload. This route has no knowledge of posterize/trace/repair at all.
//
// FIX (Jan 2026): Added prompt enhancement before sending to Pollinations.
// User prompts are transformed to request vector-friendly output (flat colors,
// bold outlines, no gradients, simple shapes) instead of photorealistic
// complexity. This dramatically improves vectorization quality because:
//  - Posterization (4-8 colors) works well on illustration/cartoon style
//  - Flat-color images preserve color accuracy during quantization
//  - VTracer produces crisp, clean paths on high-contrast simple geometry
// See lib/ai/prompt-enhancement.ts for the transformation logic.
export async function POST(req: Request): Promise<Response> {
  try {
    const bodyJson = await req.json().catch(() => null);
    let prompt = bodyJson?.prompt;
    const model = bodyJson?.model;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json({ error: 'Missing "prompt"' }, { status: 400 });
    }

    // Enhance prompt for vector-friendly output
    prompt = enhancePromptForVectorization(prompt.trim());

    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'POLLINATIONS_API_KEY is not configured on the server' },
        { status: 500 },
      );
    }

    const client = new PollinationsClient(apiKey);
    const imageBuffer = await client.generateImage(prompt, {
      model: typeof model === 'string' && model.length > 0 ? model : 'flux',
    });

    return new Response(imageBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (err) {
    if (err instanceof CurviaError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.httpStatus });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
