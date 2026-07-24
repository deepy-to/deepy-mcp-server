import { DEFAULT_HTTP_TIMEOUT_MS, MIN_RESULTS_TIMEOUT_MS } from "../config.js";
import type { DeepyConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { DeepyApiError } from "../errors.js";
import { stableStringify } from "../stable-stringify.js";
import type { FileUploadResponse } from "../types.js";

export type FetchLike = typeof fetch;

/** Max bytes to inline (base64) for image/audio results. ~8 MB. */
export const DEFAULT_MAX_INLINE_RESULT_BYTES = 8 * 1024 * 1024;

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

export interface UploadFileInput {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

/** Outcome of fetching a generation result's bytes. */
export type ResultMedia =
  | { inline: true; contentType: string; sizeBytes: number; base64: string }
  | {
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
export class DeepyApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly logger: Logger | undefined;
  private readonly timeoutMs: number;
  private readonly resultsTimeoutMs: number;
  private readonly maxInlineResultBytes: number;

  constructor(config: DeepyConfig, options: DeepyApiClientOptions = {}) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    const impl = options.fetchImpl ?? globalThis.fetch;
    if (typeof impl !== "function") {
      throw new Error(
        "No fetch implementation available. Use Node >= 22 or pass options.fetchImpl."
      );
    }
    this.fetchImpl = impl;
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs ?? config.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
    this.resultsTimeoutMs =
      options.resultsTimeoutMs ??
      config.resultsTimeoutMs ??
      Math.max(this.timeoutMs, MIN_RESULTS_TIMEOUT_MS);
    this.maxInlineResultBytes = options.maxInlineResultBytes ?? DEFAULT_MAX_INLINE_RESULT_BYTES;
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  /** Upload a reference as multipart without exposing the API key to the agent. */
  async uploadFile(input: UploadFileInput): Promise<FileUploadResponse> {
    const path = "/api/v1/public/files";
    const url = this.buildUrl(path);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.bytes)], { type: input.contentType });
    form.append("file", blob, input.filename);

    this.logger?.debug(`→ POST ${path}`);

    const { response, raw } = await this.execute(
      "POST",
      url,
      {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
      form,
      this.resultsTimeoutMs
    );

    if (!response.ok) {
      throw DeepyApiError.fromResponse(
        response.status,
        parseErrorBody(raw),
        response.headers.get("retry-after")
      );
    }

    const value = tryParseJson(raw);
    if (value === null || typeof value !== "object") {
      throw new DeepyApiError({
        code: "INVALID_RESPONSE",
        message: `The Deepy backend returned a non-JSON-object success body (HTTP ${response.status}).`,
        httpStatus: response.status,
      });
    }

    this.logger?.debug(`← ${response.status}`);
    return value as FileUploadResponse;
  }

  /**
   * Fetch a generation result's bytes WITH the API key (the server holds it),
   * so the caller never needs — and never sees — the key. Images/audio come
   * back inline as base64; videos and over-cap media are reported as not
   * inlineable so the caller can point the user to the Deepy app.
   */
  async getResultMedia(publicId: string, index: number): Promise<ResultMedia> {
    const url = this.buildUrl(
      `/api/v1/public/generations/${encodeURIComponent(publicId)}/results/${index}`
    );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "*/*",
    };

    this.logger?.debug(`→ GET results ${sanitizeForLog(publicId)}#${index}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.resultsTimeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        throw DeepyApiError.fromResponse(
          response.status,
          parseErrorBody(raw),
          response.headers.get("retry-after")
        );
      }

      const contentType = normalizeContentType(response.headers.get("content-type"));
      const declaredLength = parseContentLength(response.headers.get("content-length"));

      // Video: never inline (mcp.md §10 keeps binary streaming out of MVP).
      if (contentType.startsWith("video/")) {
        await cancelBody(response);
        return { inline: false, reason: "video", contentType, sizeBytes: declaredLength };
      }
      // Skip the download entirely if the declared size is already over the cap.
      if (declaredLength !== undefined && declaredLength > this.maxInlineResultBytes) {
        await cancelBody(response);
        return { inline: false, reason: "too-large", contentType, sizeBytes: declaredLength };
      }

      // Enforce the cap DURING the read: a missing/understated Content-Length
      // must not let the body OOM the process. Stop + cancel once over the cap.
      const capped = await readCapped(response, this.maxInlineResultBytes);
      if (capped.overCap) {
        return { inline: false, reason: "too-large", contentType, sizeBytes: capped.sizeBytes };
      }
      return {
        inline: true,
        contentType,
        sizeBytes: capped.bytes.length,
        base64: capped.bytes.toString("base64"),
      };
    } catch (cause) {
      if (cause instanceof DeepyApiError) throw cause;
      throw this.toNetworkError(cause, controller.signal.aborted, this.resultsTimeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
    return headers;
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers = this.buildHeaders(options);
    // Canonical (sorted-key) serialization → estimate and create are
    // byte-identical for any nested-parameter ordering (quote == charge).
    const body = options.body !== undefined ? stableStringify(options.body) : undefined;

    // Never log headers or the key — method + path only.
    this.logger?.debug(`→ ${method} ${path}`);

    const { response, raw } = await this.execute(method, url, headers, body, this.timeoutMs);

    if (!response.ok) {
      throw DeepyApiError.fromResponse(
        response.status,
        parseErrorBody(raw),
        response.headers.get("retry-after")
      );
    }

    const value = tryParseJson(raw);
    if (value === null || typeof value !== "object") {
      throw new DeepyApiError({
        code: "INVALID_RESPONSE",
        message: `The Deepy backend returned a non-JSON-object success body (HTTP ${response.status}).`,
        httpStatus: response.status,
      });
    }

    this.logger?.debug(`← ${response.status}`);
    return value as T;
  }

  /** Fetch + read body under one deadline; only transport failures throw here. */
  private async execute(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: RequestInit["body"],
    timeoutMs: number
  ): Promise<{ response: Response; raw: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        redirect: "error",
        signal: controller.signal,
      });
      const raw = await response.text();
      return { response, raw };
    } catch (cause) {
      throw this.toNetworkError(cause, controller.signal.aborted, timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }

  private toNetworkError(cause: unknown, aborted: boolean, timeoutMs: number): DeepyApiError {
    return new DeepyApiError({
      code: "NETWORK_ERROR",
      message: aborted
        ? `The Deepy backend did not respond within ${timeoutMs} ms.`
        : `Failed to reach the Deepy backend at ${this.baseUrl}.`,
      cause,
    });
  }
}

/** Parse an error body for the {code,message} envelope; keep raw text as message. */
function parseErrorBody(raw: string): unknown {
  if (raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

/** Parse a success body; returns undefined for empty or non-JSON. */
function tryParseJson(raw: string): unknown {
  if (raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function normalizeContentType(raw: string | null): string {
  if (!raw) return "application/octet-stream";
  const semicolon = raw.indexOf(";");
  return (semicolon >= 0 ? raw.slice(0, semicolon) : raw).trim().toLowerCase();
}

function parseContentLength(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // best-effort: nothing to do if the stream can't be cancelled.
  }
}

type CappedRead =
  { overCap: false; bytes: Buffer } | { overCap: true; sizeBytes: number | undefined };

/**
 * Read a response body while enforcing `maxBytes` DURING the stream. As soon as
 * the running total exceeds the cap, cancel the reader and report `overCap` —
 * we never accumulate more than the cap, so an understated or missing
 * Content-Length cannot exhaust memory.
 */
async function readCapped(response: Response, maxBytes: number): Promise<CappedRead> {
  const body = response.body;
  if (!body) {
    // No stream available — fall back to a (still bounded) buffered read.
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) return { overCap: true, sizeBytes: buffer.length };
    return { overCap: false, bytes: buffer };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { overCap: true, sizeBytes: undefined };
    }
    chunks.push(value);
  }
  return { overCap: false, bytes: Buffer.concat(chunks) };
}

/** Strip control chars (CR/LF/etc.) from agent-controlled values before logging. */
function sanitizeForLog(value: string): string {
  return value.replace(/\p{Cc}/gu, "");
}
