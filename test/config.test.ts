import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { ConfigError } from "../src/errors.js";

// (a) missing DEEPY_API_KEY → clear startup error.
describe("loadConfig", () => {
  it("throws a clear ConfigError mentioning DEEPY_API_KEY when the key is missing", () => {
    expect(() => loadConfig({ DEEPY_API_BASE_URL: "https://anal.plus" })).toThrow(ConfigError);
    expect(() => loadConfig({ DEEPY_API_BASE_URL: "https://anal.plus" })).toThrow(/DEEPY_API_KEY/);
  });

  it("treats a blank/whitespace key as missing", () => {
    expect(() =>
      loadConfig({ DEEPY_API_KEY: "   ", DEEPY_API_BASE_URL: "https://anal.plus" })
    ).toThrow(/DEEPY_API_KEY/);
  });

  it("throws mentioning DEEPY_API_BASE_URL when the base url is missing", () => {
    expect(() => loadConfig({ DEEPY_API_KEY: "sk_test_abc" })).toThrow(/DEEPY_API_BASE_URL/);
  });

  it("rejects a non-http(s) base url", () => {
    expect(() =>
      loadConfig({ DEEPY_API_KEY: "sk_test_abc", DEEPY_API_BASE_URL: "ftp://example.com" })
    ).toThrow(/http/i);
  });

  it("returns a trimmed config with the trailing slash stripped and default timeouts", () => {
    const config = loadConfig({
      DEEPY_API_KEY: "  sk_test_abc  ",
      DEEPY_API_BASE_URL: "https://anal.plus/",
    });
    expect(config).toEqual({
      apiKey: "sk_test_abc",
      baseUrl: "https://anal.plus",
      httpTimeoutMs: 30_000,
      resultsTimeoutMs: 120_000,
    });
  });

  it("honors DEEPY_HTTP_TIMEOUT_MS and keeps the results timeout at least 120s", () => {
    const config = loadConfig({
      DEEPY_API_KEY: "sk_test_abc",
      DEEPY_API_BASE_URL: "https://anal.plus",
      DEEPY_HTTP_TIMEOUT_MS: "5000",
    });
    expect(config.httpTimeoutMs).toBe(5000);
    expect(config.resultsTimeoutMs).toBe(120_000);
  });

  it("uses a results timeout equal to a large custom http timeout", () => {
    const config = loadConfig({
      DEEPY_API_KEY: "sk_test_abc",
      DEEPY_API_BASE_URL: "https://anal.plus",
      DEEPY_HTTP_TIMEOUT_MS: "200000",
    });
    expect(config.httpTimeoutMs).toBe(200_000);
    expect(config.resultsTimeoutMs).toBe(200_000);
  });

  it("falls back to the default timeout on an invalid DEEPY_HTTP_TIMEOUT_MS", () => {
    for (const bad of ["0", "-5", "abc", "1.5"]) {
      const config = loadConfig({
        DEEPY_API_KEY: "sk_test_abc",
        DEEPY_API_BASE_URL: "https://anal.plus",
        DEEPY_HTTP_TIMEOUT_MS: bad,
      });
      expect(config.httpTimeoutMs).toBe(30_000);
    }
  });
});
