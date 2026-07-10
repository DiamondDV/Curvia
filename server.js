import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import "dotenv/config";

const app = express();

// Allow your frontend to call the API
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://curvia-front.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "30mb" }));

const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PORT = process.env.PORT || 3001;

// ============================
// Home
// ============================

app.get("/", (req, res) => {
  res.send("✅ Curvia API is running!");
});

// ============================
// Health
// ============================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    pollinations: Boolean(POLLINATIONS_KEY),
    gemini: Boolean(GEMINI_KEY),
  });
});

// ============================
// Pollinations - Text to Image
// ============================

app.post("/api/flux", async (req, res) => {
  if (!POLLINATIONS_KEY) {
    return res
      .status(503)
      .json({ error: "POLLINATIONS_KEY not configured" });
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

    const contentType =
      upstream.headers.get("content-type") || "application/json";

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);

    if (contentType.startsWith("image/")) {
      const arrayBuffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    const text = await upstream.text();
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: String(err),
    });
  }
});

// ============================
// Pollinations - Image Edit
// ============================

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

// ============================
// Gemini
// ============================

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

// ============================
// Start Server
// ============================

app.listen(PORT, () => {
  console.log(`🚀 Curvia backend running on port ${PORT}`);

  if (!POLLINATIONS_KEY) {
    console.warn("⚠ POLLINATIONS_KEY is NOT configured.");
  }

  if (!GEMINI_KEY) {
    console.warn("⚠ GEMINI_KEY is NOT configured.");
  }
});
