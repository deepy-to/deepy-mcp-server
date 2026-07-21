/**
 * Secret redaction. The API key (and anything that looks like one, plus
 * Bearer tokens) must never appear in logs, tool output, or error text.
 * Applied both to a known key value and via generic patterns as defense
 * in depth.
 */

const API_KEY_PATTERN = /sk_(?:live|test)_[A-Za-z0-9._-]+/g;
const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const REDACTED = "sk_***REDACTED***";

export function redactSecrets(input: unknown, apiKey?: string): string {
  let text = toText(input);
  if (apiKey && apiKey.length >= 4) {
    // Literal, global replacement of the exact key (no regex escaping needed).
    text = text.split(apiKey).join(REDACTED);
  }
  text = text.replace(API_KEY_PATTERN, REDACTED);
  text = text.replace(BEARER_PATTERN, "$1***REDACTED***");
  return text;
}

function toText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Error) return `${input.name}: ${input.message}`;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
