// server.js
import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json({ limit: "30mb" }));

const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3001;

// =========================
// Pollinations Text-to-Image
// =========================
app.post("/api/flux", async (req, res) => {
  if (!POLLINATIONS_KEY) {
    return res.status(503).json({
      error: "POLLINATIONS_KEY not configured",
    });
  }

  try {
    const upstream = await fetch(
      "https://gen.pollinations.ai/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${POLLINATIONS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: String(err),
    });
  }
});

// =========================
// Pollinations Image Edit
// =========================
app.use(
  "/api/image-edit",
  createProxyMiddleware({
    target: "https://gen.pollinations.ai",
    changeOrigin: true,
    pathRewrite: {
      "^/api/image-edit": "/v1/images/edits",
    },
    on: {
      proxyReq: (proxyReq) => {
        if (POLLINATIONS_KEY) {
          proxyReq.setHeader(
            "Authorization",
            `Bearer ${POLLINATIONS_KEY}`
          );
        }
      },
    },
  })
);

// =========================
// Gemini
// =========================
app.post("/api/gemini", async (req, res) => {
  if (!GEMINI_KEY) {
    return res.status(503).json({
      error: "GEMINI_KEY not configured",
    });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      }
    );

    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json"
    );
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: String(err),
    });
  }
});

// =========================
// Health Check
// =========================
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    pollinations: Boolean(POLLINATIONS_KEY),
    gemini: Boolean(GEMINI_KEY),
  });
});

// =========================
// Start Server
// =========================
app.listen(PORT, () => {
  console.log(`Curvia backend running on http://localhost:${PORT}`);

  if (!POLLINATIONS_KEY) {
    console.warn("⚠ POLLINATIONS_KEY is not configured");
  }

  if (!GEMINI_KEY) {
    console.warn("⚠ GEMINI_KEY is not configured");
  }
});
