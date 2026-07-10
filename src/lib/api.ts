// Central API client — all calls go through the backend proxy at /api/*.
// Keys live in .env and are never shipped to the browser.

let _backendLive: boolean | null = null;

export async function checkBackend(): Promise<{ live: boolean; gemini: boolean }> {
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(2500) });
    const data = await res.json();
    _backendLive = true;
    return { live: true, gemini: Boolean(data.gemini) };
  } catch {
    _backendLive = false;
    return { live: false, gemini: false };
  }
}

export function backendLive() {
  return _backendLive;
}

// --- Pollinations ---

type PollinationsImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
  message?: string;
};

function base64ToBlob(encoded: string, contentType = "image/png") {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as PollinationsImageResponse;
    return body.error?.message || body.message || `API returned ${response.status}`;
  } catch {
    return `API returned ${response.status} ${response.statusText}`;
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
    const r = await fetch(result.url);
    if (!r.ok) throw new Error("The generated image could not be downloaded.");
    return r.blob();
  }
  throw new Error(body.error?.message || "No image data returned.");
}

export async function fluxGenerate(body: Record<string, unknown>): Promise<Blob> {
  const res = await fetch("/api/flux", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return responseToImageBlob(res);
}

export async function imageEdit(form: FormData): Promise<Blob> {
  const res = await fetch("/api/image-edit", { method: "POST", body: form });
  return responseToImageBlob(res);
}

// --- Gemini ---

export async function geminiGenerate(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}
