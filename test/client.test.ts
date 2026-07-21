import { describe, expect, it } from "vitest";
import { DeepyApiClient } from "../src/http/client.js";
import type { FetchLike } from "../src/http/client.js";
import { DeepyApiError } from "../src/errors.js";
import { TEST_CONFIG, jsonResponse, makeMockFetch, mediaResponse } from "./helpers.js";

function clientWith(fetchImpl: FetchLike): DeepyApiClient {
  return new DeepyApiClient(TEST_CONFIG, { fetchImpl });
}

describe("DeepyApiClient — requests", () => {
  it("sends Authorization: Bearer <key> and parses a JSON object", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, { ok: true }));
    const body = await clientWith(fetchImpl).get<{ ok: boolean }>("/api/v1/public/models");
    expect(body).toEqual({ ok: true });
    expect(calls[0]?.headers["authorization"]).toBe(`Bearer ${TEST_CONFIG.apiKey}`);
    expect(calls[0]?.url).toBe(`${TEST_CONFIG.baseUrl}/api/v1/public/models`);
  });

  it("serializes POST bodies canonically (recursively sorted keys)", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, {}));
    await clientWith(fetchImpl).post("/x", { body: { b: 1, a: { d: 4, c: 3 } } });
    expect(calls[0]?.body).toBe('{"a":{"c":3,"d":4},"b":1}');
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
  });

  it("adds the X-Idempotency-Key header when provided", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, {}));
    await clientWith(fetchImpl).post("/x", { body: {}, idempotencyKey: "k-1" });
    expect(calls[0]?.headers["x-idempotency-key"]).toBe("k-1");
  });

  it("forwards query params and skips undefined/empty ones", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, []));
    await clientWith(fetchImpl).get("/api/v1/public/models", {
      query: { type: "T", family: undefined, group: "" },
    });
    expect(calls[0]?.url).toContain("type=T");
    expect(calls[0]?.url).not.toContain("family");
    expect(calls[0]?.url).not.toContain("group");
  });
});

describe("DeepyApiClient — error mapping", () => {
  it("maps a {code,message} envelope to a typed DeepyApiError", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(402, { code: "INSUFFICIENT_CREDITS", message: "no funds" })
    );
    await expect(clientWith(fetchImpl).get("/x")).rejects.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
      httpStatus: 402,
    });
  });

  it("falls back to a status→code mapping when the body has no code", async () => {
    const { fetchImpl } = makeMockFetch(() => jsonResponse(404, {}));
    await expect(clientWith(fetchImpl).get("/x")).rejects.toMatchObject({
      code: "MODEL_NOT_FOUND",
    });
  });

  it("captures Retry-After on 429", async () => {
    const { fetchImpl } = makeMockFetch(
      () => new Response("{}", { status: 429, headers: { "retry-after": "5" } })
    );
    await expect(clientWith(fetchImpl).get("/x")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: "5",
    });
  });

  it("throws INVALID_RESPONSE for a non-JSON success body", async () => {
    const { fetchImpl } = makeMockFetch(() => new Response("not json", { status: 200 }));
    await expect(clientWith(fetchImpl).get("/x")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("maps a transport failure to NETWORK_ERROR", async () => {
    const fetchImpl = (async () => {
      throw new Error("boom");
    }) as unknown as FetchLike;
    await expect(clientWith(fetchImpl).get("/x")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

describe("DeepyApiClient — getResultMedia", () => {
  it("returns inline image bytes as base64 and sends the key", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const { fetchImpl, calls } = makeMockFetch(() => mediaResponse(bytes, "image/png"));
    const media = await clientWith(fetchImpl).getResultMedia("gen_1", 0);
    expect(media.inline).toBe(true);
    if (media.inline) {
      expect(media.contentType).toBe("image/png");
      expect(Buffer.from(media.base64, "base64")).toEqual(Buffer.from(bytes));
    }
    expect(calls[0]?.headers["authorization"]).toBe(`Bearer ${TEST_CONFIG.apiKey}`);
  });

  it("never inlines a video result", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([1, 2, 3]), "video/mp4")
    );
    const media = await clientWith(fetchImpl).getResultMedia("g", 0);
    expect(media.inline).toBe(false);
    if (!media.inline) expect(media.reason).toBe("video");
  });

  it("does not inline media over the byte cap", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([1, 2, 3, 4, 5, 6]), "image/png")
    );
    const client = new DeepyApiClient(TEST_CONFIG, { fetchImpl, maxInlineResultBytes: 2 });
    const media = await client.getResultMedia("g", 0);
    expect(media.inline).toBe(false);
    if (!media.inline) expect(media.reason).toBe("too-large");
  });

  it("surfaces a backend error from the results endpoint", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(404, { code: "MODEL_NOT_FOUND", message: "no" })
    );
    await expect(clientWith(fetchImpl).getResultMedia("g", 0)).rejects.toBeInstanceOf(
      DeepyApiError
    );
  });
});
