import * as GeminiProvider from "./GeminiProvider.js";

// AIProvider interface: a module exporting one function,
//   generateRecommendation(prompt: string) -> Promise<string>
// which throws a ProviderError (see ProviderError.js) on any failure.
//
// AI_PROVIDER selects which module implements it. Only "gemini" is
// implemented for this MVP; adding another provider means adding one more
// module here that satisfies the same function signature — nothing in
// server.js, lib/buildPrompt.js, or the UI needs to change.
const PROVIDERS = {
  gemini: GeminiProvider,
};

export function getProvider() {
  const name = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Supported providers: ${Object.keys(PROVIDERS).join(", ")}.`
    );
  }
  return { name, ...provider };
}
