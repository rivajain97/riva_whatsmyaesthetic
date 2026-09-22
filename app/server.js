import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProvider } from "./providers/index.js";
import { ProviderError } from "./providers/ProviderError.js";
import { buildRecommendationPrompt } from "./lib/buildPrompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const FRIENDLY_ERRORS = {
  missing_key: "The server has no AI provider API key configured. Add one to app/.env and restart the server.",
  invalid_key: "The configured AI provider API key was rejected. Check the key in app/.env and restart the server.",
  rate_limited: "The AI provider is rate-limiting requests right now. Please wait a moment and try again.",
  empty_response: "The AI provider returned an unreadable response. Please try again.",
  api_error: "The AI provider had a problem answering. Please try again in a moment.",
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/recommend", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({
      error: "Tell me where you're going, what you're wearing, or what you need an outfit for.",
    });
  }

  try {
    const provider = getProvider();
    const prompt = buildRecommendationPrompt(REPO_ROOT, message);

    console.log(`[recommend] provider=${provider.name} message="${message}"`);
    const recommendation = await provider.generateRecommendation(prompt);
    console.log(`[recommend] provider=${provider.name} succeeded, ${recommendation.length} chars`);

    res.json({ recommendation, provider: provider.name });
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(`[recommend] provider error (${err.code}):`, err.message);
      return res.status(502).json({
        error: FRIENDLY_ERRORS[err.code] || "Something went wrong while building your recommendation. Please try again.",
      });
    }

    console.error("[recommend] unexpected failure:", err);
    res.status(502).json({
      error: "Something went wrong while building your recommendation. Please try again in a moment.",
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const providerName = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  console.log(`What's My Aesthetic? running at http://localhost:${PORT} (provider: ${providerName})`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("Warning: GEMINI_API_KEY is not set — copy app/.env.example to app/.env and add your key.");
  }
});
