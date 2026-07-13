import { PollinationsClient } from '@/lib/ai/pollinations';
import { enhancePromptForVectorization } from '@/lib/ai/prompt-enhancement';
import { CurviaError, FileTypeError } from '@/lib/utils/errors';

export const runtime = 'nodejs';

// Image + text -> edited image via Pollinations' 'gptimage' model
// (image-to-image). Returns raw image bytes, same pattern as
// /api/generate — the frontend swaps the edited result into the upload
// slot and feeds it into the existing POST /api/process pipeline.
//
// FIX (Jan 2026): Added prompt enhancement before sending to Pollinations.
// Edit prompts are transformed to request vector-friendly modifications
// (e.g., "make it flatter" → "reduce to flat colors, remove gradients, bold outlines").
// This ensures edited images remain suitable for vectorization.
// See lib/ai/prompt-enhancement.ts for the transformation logic.
export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();

    const image = formData.get('image');
    if (!(image instanceof File)) {
      throw new FileTypeError('Missing or invalid "image" field');
    }

    let promptField = formData.get('prompt');
    if (typeof promptField !== 'string' || promptField.trim().length === 0) {
      return Response.json({ error: 'Missing "prompt"' }, { status: 400 });
    }

    // Enhance prompt for vector-friendly edits
    promptField = enhancePromptForVectorization(promptField.trim());

    const modelField = formData.get('model');
    const model = typeof modelField === 'string' && modelField.length > 0 ? modelField : 'gptimage';

    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: 'POLLINATIONS_API_KEY is not configured on the server' },
        { status: 500 },
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const client = new PollinationsClient(apiKey);
    const editedBuffer = await client.editImage(imageBuffer, image.type, promptField, { model });

    return new Response(editedBuffer, {
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
