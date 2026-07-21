import { createHash } from "node:crypto";
import { stableStringify } from "./stable-stringify.js";
import type { GenerationBody } from "./types.js";

/**
 * Derive a deterministic `X-Idempotency-Key` from the create body.
 *
 * Properties enforced by design:
 *  - stable per body: identical bodies (any key order) → identical key;
 *  - never reused across different bodies: any change → different key.
 *
 * A caller may still pass an explicit key to force a fresh generation of
 * an otherwise-identical request (see `normalizeIdempotencyKey`).
 */
export function idempotencyKeyForBody(body: GenerationBody): string {
  const canonical = stableStringify(body);
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 32);
  return `deepy-mcp-${digest}`;
}

/** Trim/validate a caller-supplied key; returns undefined when empty. */
export function normalizeIdempotencyKey(key: string | undefined): string | undefined {
  if (typeof key !== "string") return undefined;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
