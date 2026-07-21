import { ConfigError } from "./errors.js";
/** Default per-request deadline for JSON calls, overridable via DEEPY_HTTP_TIMEOUT_MS. */
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
/** Result-media fetches can be larger; they get at least this deadline. */
export const MIN_RESULTS_TIMEOUT_MS = 120_000;
/**
 * Load and validate configuration from the environment.
 *
 * The API key is read ONLY from the environment (never from tool arguments
 * or user text). A missing key or base URL produces a clear, actionable
 * startup error and no server is started.
 */
export function loadConfig(env = process.env) {
    const apiKey = (env.DEEPY_API_KEY ?? "").trim();
    if (apiKey.length === 0) {
        throw new ConfigError("DEEPY_API_KEY is not set. Provide your Deepy API key (sk_live_… or sk_test_…) via the " +
            "DEEPY_API_KEY environment variable in your MCP client config. See .env.example.");
    }
    const rawBaseUrl = (env.DEEPY_API_BASE_URL ?? "").trim();
    if (rawBaseUrl.length === 0) {
        throw new ConfigError("DEEPY_API_BASE_URL is not set. Provide the Deepy API base URL (dev stand: " +
            "https://app.prod.einfra.tech) via the DEEPY_API_BASE_URL environment variable. See .env.example.");
    }
    let parsed;
    try {
        parsed = new URL(rawBaseUrl);
    }
    catch {
        throw new ConfigError(`DEEPY_API_BASE_URL is not a valid URL: "${rawBaseUrl}".`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ConfigError(`DEEPY_API_BASE_URL must be an http(s) URL; got "${parsed.protocol}" in "${rawBaseUrl}".`);
    }
    const httpTimeoutMs = parsePositiveIntEnv(env.DEEPY_HTTP_TIMEOUT_MS, DEFAULT_HTTP_TIMEOUT_MS);
    const resultsTimeoutMs = Math.max(httpTimeoutMs, MIN_RESULTS_TIMEOUT_MS);
    return {
        baseUrl: rawBaseUrl.replace(/\/+$/, ""),
        apiKey,
        httpTimeoutMs,
        resultsTimeoutMs,
    };
}
/** Parse a positive-integer env var; fall back (no throw) on missing/invalid. */
function parsePositiveIntEnv(raw, fallback) {
    if (raw === undefined || raw.trim().length === 0)
        return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0)
        return fallback;
    return value;
}
//# sourceMappingURL=config.js.map