import { describe, expect, it } from "vitest";
import { idempotencyKeyForBody, normalizeIdempotencyKey } from "../src/idempotency.js";
import { buildGenerationBody } from "../src/generation-body.js";

// (d) X-Idempotency-Key auto-generated + stable per body.
describe("idempotencyKeyForBody", () => {
  it("is identical for logically-equal bodies regardless of key order", () => {
    const a = buildGenerationBody({
      modelName: "m",
      prompt: "p",
      parameters: { a: 1, b: 2, nested: { x: 1, y: 2 } },
      referenceFiles: [],
    });
    const b = buildGenerationBody({
      modelName: "m",
      prompt: "p",
      parameters: { nested: { y: 2, x: 1 }, b: 2, a: 1 },
      referenceFiles: [],
    });
    expect(idempotencyKeyForBody(a)).toBe(idempotencyKeyForBody(b));
  });

  it("changes when any part of the body changes", () => {
    const base = buildGenerationBody({ modelName: "m", prompt: "p" });
    expect(idempotencyKeyForBody(base)).not.toBe(
      idempotencyKeyForBody(buildGenerationBody({ modelName: "m", prompt: "p2" }))
    );
    expect(idempotencyKeyForBody(base)).not.toBe(
      idempotencyKeyForBody(buildGenerationBody({ modelName: "m2", prompt: "p" }))
    );
    expect(idempotencyKeyForBody(base)).not.toBe(
      idempotencyKeyForBody(
        buildGenerationBody({ modelName: "m", prompt: "p", parameters: { seed: 1 } })
      )
    );
  });

  it("produces a header-safe, deterministic key", () => {
    const key = idempotencyKeyForBody(buildGenerationBody({ modelName: "m", prompt: "p" }));
    expect(key).toMatch(/^deepy-mcp-[0-9a-f]{32}$/);
  });
});

describe("normalizeIdempotencyKey", () => {
  it("trims values and rejects empty/undefined", () => {
    expect(normalizeIdempotencyKey("  my-key  ")).toBe("my-key");
    expect(normalizeIdempotencyKey("   ")).toBeUndefined();
    expect(normalizeIdempotencyKey("")).toBeUndefined();
    expect(normalizeIdempotencyKey(undefined)).toBeUndefined();
  });
});
