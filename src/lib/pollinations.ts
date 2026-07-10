const API_ROOT = "https://gen.pollinations.ai";

export const VECTOR_STYLE_PROMPT =
  "A flat 2D vector art style illustration of {{SUBJECT}}, minimalist graphic design. Clean bold outlines, sharp crisp edges, smooth geometric curves, and solid filled shapes. Use a highly limited, cohesive color palette with a maximum of 4 solid colors. Strictly no gradients, no soft shading, no intricate textures, and no photorealism. Completely isolated on a pure, solid white background with zero drop shadows, zero ambient occlusion, and zero background depth.";

type PollinationsImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
  message?: string;
};

function buildVectorPrompt(subject: string, hasReference: boolean) {
  const cleanSubject = subject.trim() || "the subject and composition in the reference image";
  const styled = VECTOR_STYLE_PROMPT.replace("{{SUBJECT}}", cleanSubject);

  if (!hasReference) return styled;

  return [
    "Recreate the uploaded reference while preserving its recognizable subject, silhouette, and composition.",
    styled,
    "Simplify small photographic details into distinct, closed, vector-friendly shapes. Keep every boundary high-contrast and unambiguous.",
  ].join(" ");
}

function base64ToBlob(encoded: string, contentType = "image/png") {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as PollinationsImageResponse;
    return body.error?.message || body.message || `Pollinations returned ${response.status}`;
  } catch {
    return `Pollinations returned ${response.status} ${response.statusText}`;
  }
}

async function responseToImageBlob(response: Response) {
  if (!response.ok) throw new Error(await readError(response));

  const type = response.headers.get("content-type") || "";
  if (type.startsWith("image/")) return response.blob();

  const body = (await response.json()) as PollinationsImageResponse;
  const result = body.data?.[0];
  if (result?.b64_json) return base64ToBlob(result.b64_json);

  if (result?.url) {
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) throw new Error("The generated image could not be downloaded.");
    return imageResponse.blob();
  }

  throw new Error(body.error?.message || "Pollinations returned no image data.");
}

export async function generateVectorSource({
  prompt,
  reference,
  apiKey,
}: {
  prompt: string;
  reference: File | null;
  apiKey: string;
}) {
  const vectorPrompt = buildVectorPrompt(prompt, Boolean(reference));

  if (reference) {
    const form = new FormData();
    form.append("image", reference, reference.name);
    form.append("prompt", vectorPrompt);
    form.append("model", "gptimage");
    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("response_format", "b64_json");
    form.append("safe", "true");

    const response = await fetch(`${API_ROOT}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    return {
      blob: await responseToImageBlob(response),
      model: "GPT Image 1 Mini",
      prompt: vectorPrompt,
    };
  }

  const response = await fetch(`${API_ROOT}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: vectorPrompt,
      model: "flux",
      n: 1,
      size: "768x768",
      quality: "medium",
      response_format: "b64_json",
      safe: true,
    }),
  });

  return {
    blob: await responseToImageBlob(response),
    model: "Flux Schnell",
    prompt: vectorPrompt,
  };
}
