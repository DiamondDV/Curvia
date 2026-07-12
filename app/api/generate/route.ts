import { PollinationsClient } from '@/lib/ai/pollinations';
import { CurviaError } from '@/lib/utils/errors';

export const runtime = 'nodejs';

// Text -> image via Pollinations' 'flux' model. Returns raw image bytes
// (not a job id) — the frontend wraps this into a File and feeds it
// straight into the existing POST /api/process pipeline, same as a manual
// upload. This route has no knowledge of posterize/trace/repair at all.
export async function POST(req: Request): Promise<Response> {
  try {
    const bodyJson = await req.json().catch(() => null);
    const prompt = bodyJson?.prompt;
    const model = bodyJson?.model;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json({ error: 'Missing "prompt"' }, { status: 400 });
    }

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
