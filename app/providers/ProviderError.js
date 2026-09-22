// A small, provider-independent error shape. Every AIProvider throws this
// (never a raw SDK error) so server.js can turn any provider's failure into
// a friendly message without knowing which provider is in use.
//
// code is one of: "missing_key" | "invalid_key" | "rate_limited" |
//                  "empty_response" | "api_error"
export class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
