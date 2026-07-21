import type { DeepyConfig } from "../config.js";
import type { Logger } from "../logger.js";
export type FetchLike = typeof fetch;
/** Max bytes to inline (base64) for image/audio results. ~8 MB. */
export declare const DEFAULT_MAX_INLINE_RESULT_BYTES: number;
export interface DeepyApiClientOptions {
    /** Injectable fetch — tests pass a mock so no network is ever touched. */
    fetchImpl?: FetchLike;
    logger?: Logger;
    /** JSON request deadline (ms). Defaults to config.httpTimeoutMs. */
    timeoutMs?: number;
    /** Result-media fetch deadline (ms). Defaults to config.resultsTimeoutMs. */
    resultsTimeoutMs?: number;
    /** Max bytes to inline for image/audio results. */
    maxInlineResultBytes?: number;
}
export interface RequestOptions {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    idempotencyKey?: string;
}
/** Outcome of fetching a generation result's bytes. */
export type ResultMedia = {
    inline: true;
    contentType: string;
    sizeBytes: number;
    base64: string;
} | {
    inline: false;
    reason: "video" | "too-large";
    contentType: string;
    sizeBytes: number | undefined;
};
/**
 * Thin HTTP client for the Deepy public API.
 *
 * - always sends `Authorization: Bearer <apiKey>`;
 * - never logs the key or any header (method + path only, at debug level);
 * - serializes request bodies canonically (sorted keys) so estimate/create
 *   are byte-identical regardless of the caller's key order (quote == charge);
 * - refuses to follow redirects (`redirect: "error"`) so the Authorization
 *   header can never be replayed to another origin;
 * - bounds every request with an AbortController deadline;
 * - parses the `{code,message}` error envelope into a typed `DeepyApiError`.
 */
export declare class DeepyApiClient {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly fetchImpl;
    private readonly logger;
    private readonly timeoutMs;
    private readonly resultsTimeoutMs;
    private readonly maxInlineResultBytes;
    constructor(config: DeepyConfig, options?: DeepyApiClientOptions);
    get<T>(path: string, options?: RequestOptions): Promise<T>;
    post<T>(path: string, options?: RequestOptions): Promise<T>;
    /**
     * Fetch a generation result's bytes WITH the API key (the server holds it),
     * so the caller never needs — and never sees — the key. Images/audio come
     * back inline as base64; videos and over-cap media are reported as not
     * inlineable so the caller can point the user to the Deepy app.
     */
    getResultMedia(publicId: string, index: number): Promise<ResultMedia>;
    private buildUrl;
    private buildHeaders;
    private request;
    /** Fetch + read body under one deadline; only transport failures throw here. */
    private execute;
    private toNetworkError;
}
//# sourceMappingURL=client.d.ts.map