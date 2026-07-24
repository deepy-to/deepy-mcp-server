import type { DeepyConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { FileUploadResponse } from "../types.js";
export type FetchLike = typeof fetch;
/** Max bytes to treat as "inlineable" image/audio payload. ~8 MB. */
export declare const DEFAULT_MAX_INLINE_RESULT_BYTES: number;
/** Max bytes to download for local file delivery (images + videos). ~50 MB. */
export declare const DEFAULT_MAX_DOWNLOAD_RESULT_BYTES: number;
export interface DeepyApiClientOptions {
    /** Injectable fetch — tests pass a mock so no network is ever touched. */
    fetchImpl?: FetchLike;
    logger?: Logger;
    /** JSON request deadline (ms). Defaults to config.httpTimeoutMs. */
    timeoutMs?: number;
    /** Result-media fetch deadline (ms). Defaults to config.resultsTimeoutMs. */
    resultsTimeoutMs?: number;
    /** Max bytes to treat as inlineable image/audio. */
    maxInlineResultBytes?: number;
    /** Max bytes to download for local file delivery (incl. video). */
    maxDownloadResultBytes?: number;
}
export interface RequestOptions {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    idempotencyKey?: string;
}
export interface UploadFileInput {
    bytes: Uint8Array;
    filename: string;
    contentType: string;
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
    /**
     * Present when bytes were downloaded for local file delivery (videos and
     * oversized media under the download cap). Absent only when the body was
     * too large to fetch safely.
     */
    base64?: string;
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
    private readonly maxDownloadResultBytes;
    constructor(config: DeepyConfig, options?: DeepyApiClientOptions);
    get<T>(path: string, options?: RequestOptions): Promise<T>;
    post<T>(path: string, options?: RequestOptions): Promise<T>;
    /** Upload a reference as multipart without exposing the API key to the agent. */
    uploadFile(input: UploadFileInput): Promise<FileUploadResponse>;
    /**
     * Fetch a generation result's bytes WITH the API key (the server holds it),
     * so the caller never needs — and never sees — the key. Small images/audio
     * come back as `inline: true`. Videos (and oversized media under the download
     * cap) come back as `inline: false` WITH `base64` so the tool can save a local
     * file on the user's machine. Bodies over the download cap are refused.
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