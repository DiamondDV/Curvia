// Text-to-image and image-to-image via the backend proxy.
// Keys live in .env on the server — never exposed to the browser.
import { fluxGenerate, imageEdit } from "./api";

const TEXT_STYLE_SUFFIX =
  ", flat vector illustration style, thick uniform dark outline, solid flat colors only, no gradients, no shadows, no shading, no texture, no noise, sticker design, bold clean lines, minimalist cartoon vector art, white background, centered composition, high contrast, professional vector clipart style";

const RESTYLE_STYLE_SUFFIX =
  " Render as flat vector art with solid uniform colors. No gradients, no soft shading, no photographic textures, no noise, no drop shadows, no blur. Keep the design fully driven by the user's prompt above — do not add outlines, borders, sticker styling, or compositional changes that were not requested.";

function buildTextPrompt(userPrompt: string) {
  const trimmed = userPrompt.trim();
  return trimmed ? `${trimmed}${TEXT_STYLE_SUFFIX}` : `A simple flat icon${TEXT_STYLE_SUFFIX}`;
}

export async function generateFluxImage({ prompt }: { prompt: string }) {
  const fluxPrompt = buildTextPrompt(prompt);
  const blob = await fluxGenerate({
    prompt: fluxPrompt,
    model: "flux",
    n: 1,
    size: "768x768",
    quality: "medium",
    response_format: "b64_json",
    safe: true,
  });
  return { blob, model: "Flux Schnell", prompt: fluxPrompt };
}

export async function restyleImage({ file, prompt }: { file: File; prompt: string }) {
  const trimmed = prompt.trim();
  const baseText = trimmed
    ? `Apply this change to the uploaded image: ${trimmed}. Keep the same subject and composition unless the change explicitly asks otherwise.`
    : `Recreate this exact uploaded image, preserving its subject, silhouette, composition, and colors exactly.`;
  const instruction = `${baseText}${RESTYLE_STYLE_SUFFIX}`;

  const form = new FormData();
  form.append("image", file, file.name);
  form.append("prompt", instruction);
  form.append("model", "gptimage");
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("response_format", "b64_json");
  form.append("safe", "true");

  const blob = await imageEdit(form);
  return { blob, model: "GPT Image 1 Mini", prompt: instruction };
}
