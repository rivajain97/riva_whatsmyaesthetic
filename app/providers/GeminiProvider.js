import { GoogleGenAI, ApiError } from "@google/genai";
import { ProviderError } from "./ProviderError.js";

const MODEL = "gemini-3.6-flash";

// Gemini's shared "flash" capacity intermittently returns 503 UNAVAILABLE
// ("high demand, try again") — observed directly while testing this
// provider: the same request failed once, then succeeded on immediate
// retry. This is a transient infrastructure condition, not a bad request,
// so it's worth one quiet retry before surfacing it to the user.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// AIProvider contract: generateRecommendation(prompt: string) -> Promise<string>.
// Takes one fully-assembled prompt (built by lib/buildPrompt.js from the real
// project data) and returns the model's raw text response. All wardrobe/
// aesthetic-profile logic lives outside this file — a new provider only
// needs to implement this same function.
export async function generateRecommendation(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      "missing_key",
      "No GEMINI_API_KEY is configured on the server."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  let response;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });
      break;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          throw new ProviderError("invalid_key", "Gemini rejected the configured API key.");
        }
        if (err.status === 429) {
          throw new ProviderError("rate_limited", "Gemini rate-limited this request.");
        }
        if (err.status === 503 && attempt < MAX_ATTEMPTS) {
          console.warn(`[gemini] 503 (high demand) on attempt ${attempt}, retrying...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new ProviderError("api_error", `Gemini API error (status ${err.status}): ${err.message}`);
      }
      throw new ProviderError("api_error", `Gemini request failed: ${err.message}`);
    }
  }

  const text = response?.text;
  if (!text || !text.trim()) {
    throw new ProviderError("empty_response", "Gemini returned an empty or unreadable response.");
  }

  return text;
}
