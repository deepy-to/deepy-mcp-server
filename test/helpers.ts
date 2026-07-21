import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DeepyApiClient } from "../src/http/client.js";
import type { DeepyApiClientOptions, FetchLike } from "../src/http/client.js";
import type { DeepyConfig } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import type { ToolContext } from "../src/tools/context.js";

/**
 * Shared test fixtures. Everything here is offline: `makeMockFetch` injects a
 * fake `fetch` so no test ever touches the network. The API key is a fake
 * `sk_test_…` value used to prove redaction (literal + pattern).
 */
export const TEST_CONFIG: DeepyConfig = {
  apiKey: "sk_test_UNITTESTKEY0123456789",
  baseUrl: "https://api.example.test",
  httpTimeoutMs: 30_000,
  resultsTimeoutMs: 120_000,
};

/** A request captured by the mock fetch (header keys are lower-cased). */
export interface RecordedCall {
  url: string;
  method: string;
  body: string | undefined;
  headers: Record<string, string>;
}

/** JSON success/error response with the `content-type: application/json` header. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Binary media response (used to exercise deepy_get_result inlining). */
export function mediaResponse(bytes: Uint8Array, contentType: string): Response {
  // Cast: a Uint8Array is a valid BodyInit at runtime, but the DOM/undici lib
  // typings resolved here don't include it in the BodyInit union.
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
}

/**
 * Build an injectable `fetch` that records every call and delegates the response
 * to `handler`. Returns the impl plus the recorded-calls array for assertions.
 */
export function makeMockFetch(handler: (req: RecordedCall) => Response): {
  fetchImpl: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const call: RecordedCall = {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: normalizeHeaders(init?.headers),
    };
    calls.push(call);
    return handler(call);
  }) as unknown as FetchLike;
  return { fetchImpl, calls };
}

/** Assemble a ToolContext around the mock fetch (optional client overrides). */
export function makeToolContext(
  fetchImpl: FetchLike,
  config: DeepyConfig = TEST_CONFIG,
  clientOptions: DeepyApiClientOptions = {}
): ToolContext {
  const logger = createLogger({ apiKey: config.apiKey, level: "silent" });
  const client = new DeepyApiClient(config, { fetchImpl, logger, ...clientOptions });
  return { client, config, apiKey: config.apiKey, logger };
}

/** Concatenate the text of every text block in a tool result. */
export function textOf(result: CallToolResult): string {
  return (result.content ?? [])
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("\n");
}

/** Serialize the WHOLE result (incl. image/audio data) — for key-leak assertions. */
export function serializeResult(result: CallToolResult): string {
  return JSON.stringify(result);
}

function normalizeHeaders(headers: RequestInit["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[String(key).toLowerCase()] = String(value);
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      out[key.toLowerCase()] = String(value);
    }
  }
  return out;
}
