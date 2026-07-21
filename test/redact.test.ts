import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/redact.js";

const KEY = "sk_test_UNITTESTKEY0123456789";

/**
 * (b) The API key must never appear in logs, tool output, or error text.
 * `redactSecrets` is the single choke point that guarantees it, both via the
 * known-key literal replacement and via generic sk_/Bearer patterns.
 */
describe("redactSecrets", () => {
  it("redacts the exact known API key by literal match", () => {
    const out = redactSecrets(`using ${KEY} now`, KEY);
    expect(out).not.toContain(KEY);
    expect(out).toContain("sk_***REDACTED***");
  });

  it("redacts sk_live_/sk_test_ tokens even when no known key is passed", () => {
    const live = "sk_live_ABCdef123456";
    expect(redactSecrets(`key=${live}`)).not.toContain(live);
    const test = "sk_test_ZZZ999";
    expect(redactSecrets(`key=${test}`)).not.toContain(test);
  });

  it("redacts Bearer tokens of any value", () => {
    const out = redactSecrets("Authorization: Bearer abc.def-123~456");
    expect(out).not.toContain("abc.def-123~456");
    expect(out).toContain("Bearer ***REDACTED***");
  });

  it("redacts a key embedded in an Error message", () => {
    const out = redactSecrets(new Error(`boom ${KEY}`), KEY);
    expect(out).not.toContain(KEY);
  });

  it("redacts a key nested inside an object", () => {
    const out = redactSecrets({ echoed: KEY, nested: { k: KEY } }, KEY);
    expect(out).not.toContain(KEY);
  });

  it("ignores an implausibly short known key (pattern still applies)", () => {
    // A <4-char key is not literal-replaced (too collision-prone), but a real
    // sk_ token in the same text is still caught by the pattern.
    const out = redactSecrets(`abc ${KEY}`, "ab");
    expect(out).toContain("abc");
    expect(out).not.toContain(KEY);
  });

  it("leaves non-secret text unchanged", () => {
    expect(redactSecrets("hello world", KEY)).toBe("hello world");
  });

  it("stringifies non-string inputs without throwing", () => {
    expect(redactSecrets(42, KEY)).toBe("42");
    expect(redactSecrets(null, KEY)).toBe("null");
  });
});
