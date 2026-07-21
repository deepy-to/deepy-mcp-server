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
export declare function idempotencyKeyForBody(body: GenerationBody): string;
/** Trim/validate a caller-supplied key; returns undefined when empty. */
export declare function normalizeIdempotencyKey(key: string | undefined): string | undefined;
//# sourceMappingURL=idempotency.d.ts.map