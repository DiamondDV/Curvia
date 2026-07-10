// Minimal Express proxy that keeps API keys in .env and never exposes them
// to the browser. The client calls /api/generate and /api/image-edit; this
// server forwards to Pollinations and Gemini, attaches the real keys.
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "30mb" }));

const POLLINATIONS_KEY = process.env.VITE_POLLINATIONS_KEY || "";
const GEMINI_KEY = process.env.VITE_GEMINI_KEY || "";
const PORT = process.env.PORT || 3001;

// POST /api/flux  → Pollinations text-to-image
app.post("/api/flux", async (req, res) => {
  try {
    const upstream = await fetch("https://gen.pollinations.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POLLINATIONS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/image-edit  → Pollinations image-to-image (multipart)
// The client sends multipart/form-data with the image + prompt; we proxy it.
app.post("/api/image-edit", (req, res) => {
  const proxy = createProxyMiddleware({
    target: "https://gen.pollinations.ai",
    changeOrigin: true,
    pathRewrite: { "^/api/image-edit": "/v1/images/edits" },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader("Authorization", `Bearer ${POLLINATIONS_KEY}`);
      },
    },
  });
  proxy(req, res, () => {});
});

// POST /api/gemini  → Gemini generateContent
app.post("/api/gemini", async (req, res) => {
  if (!GEMINI_KEY) return res.status(503).json({ error: "GEMINI_KEY not configured" });
  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Health check — client checks this to know whether backend is live
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    pollinations: Boolean(POLLINATIONS_KEY),
    gemini: Boolean(GEMINI_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Curvia backend running on http://localhost:${PORT}`);
  if (!POLLINATIONS_KEY) console.warn("  VITE_POLLINATIONS_KEY is not set");
  if (!GEMINI_KEY) console.warn("  VITE_GEMINI_KEY is not set (prompt enhancement disabled)");
});
