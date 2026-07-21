/** Default per-request deadline for JSON calls, overridable via DEEPY_HTTP_TIMEOUT_MS. */
export declare const DEFAULT_HTTP_TIMEOUT_MS = 30000;
/** Result-media fetches can be larger; they get at least this deadline. */
export declare const MIN_RESULTS_TIMEOUT_MS = 120000;
export interface DeepyConfig {
    /** Base URL with no trailing slash, e.g. https://app.prod.einfra.tech */
    baseUrl: string;
    /** API key (sk_live_… / sk_test_…). Read ONLY from env; never logged. */
    apiKey: string;
    /** Per-request deadline (ms) for JSON calls. From DEEPY_HTTP_TIMEOUT_MS. */
    httpTimeoutMs: number;
    /** Deadline (ms) for the (potentially large) result-media fetch. */
    resultsTimeoutMs: number;
}
/**
 * Load and validate configuration from the environment.
 *
 * The API key is read ONLY from the environment (never from tool arguments
 * or user text). A missing key or base URL produces a clear, actionable
 * startup error and no server is started.
 */
export declare function loadConfig(env?: NodeJS.ProcessEnv): DeepyConfig;
//# sourceMappingURL=config.d.ts.map