import { describe, expect, it } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { makeListModelsHandler } from "../src/tools/list-models.js";
import { makeGetModelHandler } from "../src/tools/get-model.js";
import { makeImprovePromptHandler } from "../src/tools/improve-prompt.js";
import { makeEstimateGenerationHandler } from "../src/tools/estimate-generation.js";
import { makeCreateGenerationHandler } from "../src/tools/create-generation.js";
import { makeGetGenerationHandler } from "../src/tools/get-generation.js";
import { makeGetResultHandler } from "../src/tools/get-result.js";
import {
  TEST_CONFIG,
  jsonResponse,
  makeMockFetch,
  makeToolContext,
  mediaResponse,
  serializeResult,
  textOf,
} from "./helpers.js";

function findBlock(
  result: CallToolResult,
  type: "image" | "audio"
): { type: string; data: string; mimeType: string } | undefined {
  const block = (result.content ?? []).find((b) => b.type === type);
  return block as { type: string; data: string; mimeType: string } | undefined;
}

// (c) deepy_create_generation refused when confirmed !== true (no HTTP call made).
describe("deepy_create_generation — confirmation gate (c)", () => {
  it("refuses and makes NO HTTP call when confirmed is false", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, { publicId: "x" }));
    const handler = makeCreateGenerationHandler(makeToolContext(fetchImpl));

    const result = await handler({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: false,
      idempotencyKey: undefined,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/confirm/i);
    expect(calls).toHaveLength(0);
  });
});

// (f) quote == charge: estimate and create send byte-identical bodies.
describe("quote == charge (f)", () => {
  it("estimate and create send byte-identical request bodies", async () => {
    const { fetchImpl, calls } = makeMockFetch((req) =>
      req.url.endsWith("/estimate")
        ? jsonResponse(200, { tokens: 3, userBalanceAfter: 10 })
        : jsonResponse(200, { publicId: "gen_1", status: "PENDING" })
    );
    const ctx = makeToolContext(fetchImpl);

    const shared = {
      modelName: "bytedance/seedream-v4.5",
      prompt: "a serene mountain lake at dawn",
      parameters: { width: 1024, height: 1024 } as Record<string, unknown>,
      referenceFiles: [] as string[],
    };

    await makeEstimateGenerationHandler(ctx)({ ...shared });
    await makeCreateGenerationHandler(ctx)({
      ...shared,
      confirmed: true,
      idempotencyKey: undefined,
    });

    const estimateBody = calls.find((c) => c.url.endsWith("/estimate"))?.body;
    const createBody = calls.find((c) => c.url.endsWith("/generations"))?.body;

    expect(estimateBody).toBeDefined();
    expect(estimateBody).toBe(createBody);
    expect(JSON.parse(estimateBody ?? "null")).toEqual({
      modelName: shared.modelName,
      prompt: shared.prompt,
      parameters: shared.parameters,
      referenceFiles: shared.referenceFiles,
    });
  });

  it("stays byte-identical even when nested parameter keys are reordered (5)", async () => {
    const { fetchImpl, calls } = makeMockFetch((req) =>
      req.url.endsWith("/estimate")
        ? jsonResponse(200, { tokens: 3, userBalanceAfter: 10 })
        : jsonResponse(200, { publicId: "gen_1", status: "PENDING" })
    );
    const ctx = makeToolContext(fetchImpl);

    await makeEstimateGenerationHandler(ctx)({
      modelName: "m",
      prompt: "p",
      parameters: { seed: 7, size: { w: 1, h: 2 }, cfg: 3 },
      referenceFiles: undefined,
    });
    await makeCreateGenerationHandler(ctx)({
      modelName: "m",
      prompt: "p",
      parameters: { cfg: 3, size: { h: 2, w: 1 }, seed: 7 },
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: undefined,
    });

    const estimateBody = calls.find((c) => c.url.endsWith("/estimate"))?.body;
    const createBody = calls.find((c) => c.url.endsWith("/generations"))?.body;
    expect(estimateBody).toBe(createBody);
  });

  it("improve_prompt sends {prompt, modality} (style omitted when absent)", async () => {
    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, { data: { prompt: "improved" } })
    );
    const ctx = makeToolContext(fetchImpl);

    await makeImprovePromptHandler(ctx)({ prompt: "cat", modality: "image", style: undefined });
    expect(JSON.parse(calls[0]?.body ?? "null")).toEqual({ prompt: "cat", modality: "image" });

    await makeImprovePromptHandler(ctx)({ prompt: "cat", modality: "image", style: "cinematic" });
    expect(JSON.parse(calls[1]?.body ?? "null")).toEqual({
      prompt: "cat",
      modality: "image",
      style: "cinematic",
    });
  });
});

// (d) X-Idempotency-Key auto-generated + stable per body (through the create tool).
describe("deepy_create_generation — idempotency (d)", () => {
  it("auto-generates a stable X-Idempotency-Key for identical bodies", async () => {
    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "PENDING" })
    );
    const handler = makeCreateGenerationHandler(makeToolContext(fetchImpl));
    const args = {
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true as const,
      idempotencyKey: undefined,
    };

    await handler({ ...args });
    await handler({ ...args });

    const k1 = calls[0]?.headers["x-idempotency-key"];
    const k2 = calls[1]?.headers["x-idempotency-key"];
    expect(k1).toMatch(/^deepy-mcp-[0-9a-f]{32}$/);
    expect(k1).toBe(k2);
  });

  it("honors a caller-supplied idempotency key", async () => {
    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "PENDING" })
    );
    const handler = makeCreateGenerationHandler(makeToolContext(fetchImpl));
    await handler({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: "caller-key-123",
    });
    expect(calls[0]?.headers["x-idempotency-key"]).toBe("caller-key-123");
  });
});

// (e) backend {code,message} errors surfaced through tools, never swallowed.
describe("backend errors surfaced through tools (e)", () => {
  it("surfaces INSUFFICIENT_CREDITS from create (with guidance)", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(402, { code: "INSUFFICIENT_CREDITS", message: "not enough tokens" })
    );
    const result = await makeCreateGenerationHandler(makeToolContext(fetchImpl))({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: undefined,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("INSUFFICIENT_CREDITS");
    expect(textOf(result)).toContain("top up");
  });

  it("surfaces MODEL_NOT_FOUND from estimate", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(404, { code: "MODEL_NOT_FOUND", message: "unknown model" })
    );
    const result = await makeEstimateGenerationHandler(makeToolContext(fetchImpl))({
      modelName: "nope",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("MODEL_NOT_FOUND");
  });

  it("surfaces CONTENT_REJECTED and IDEMPOTENCY_CONFLICT", async () => {
    const rejected = await makeCreateGenerationHandler(
      makeToolContext(
        makeMockFetch(() => jsonResponse(422, { code: "CONTENT_REJECTED", message: "no" }))
          .fetchImpl
      )
    )({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: undefined,
    });
    expect(textOf(rejected)).toContain("CONTENT_REJECTED");

    const conflict = await makeCreateGenerationHandler(
      makeToolContext(
        makeMockFetch(() => jsonResponse(409, { code: "IDEMPOTENCY_CONFLICT", message: "dup" }))
          .fetchImpl
      )
    )({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: undefined,
    });
    expect(textOf(conflict)).toContain("IDEMPOTENCY_CONFLICT");
    expect(textOf(conflict)).toMatch(/do NOT|not auto-retry/i);
  });
});

// (b) API key never appears in tool output.
describe("api key redaction in tool output (b)", () => {
  it("redacts the key from a create response that echoes it", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "PENDING", echoed: TEST_CONFIG.apiKey })
    );
    const result = await makeCreateGenerationHandler(makeToolContext(fetchImpl))({
      modelName: "m",
      prompt: "p",
      parameters: undefined,
      referenceFiles: undefined,
      confirmed: true,
      idempotencyKey: undefined,
    });
    expect(serializeResult(result)).not.toContain(TEST_CONFIG.apiKey);
  });
});

// (1 / GAP-6) deepy_get_result — server fetches bytes, inlines image/audio, notes video/large.
describe("deepy_get_result (GAP-6)", () => {
  it("returns an inline image content block and never the key", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    const { fetchImpl } = makeMockFetch(() => mediaResponse(bytes, "image/png"));
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "gen_img",
      index: undefined,
    });

    expect(result.isError).toBeFalsy();
    const image = findBlock(result, "image");
    expect(image?.mimeType).toBe("image/png");
    expect(Buffer.from(image?.data ?? "", "base64")).toEqual(Buffer.from(bytes));
    expect(serializeResult(result)).not.toContain(TEST_CONFIG.apiKey);
    // No key and no raw results URL in the human-readable text.
    expect(textOf(result)).not.toMatch(/Bearer|DEEPY_API_KEY|results\/0/);
  });

  it("returns an inline audio content block", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([5, 6, 7]), "audio/mpeg")
    );
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "gen_aud",
      index: 1,
    });
    const audio = findBlock(result, "audio");
    expect(audio?.mimeType).toBe("audio/mpeg");
    expect(audio?.data).toBeTruthy();
  });

  it("returns a note (not inline) for video results", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([1, 2, 3]), "video/mp4")
    );
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "gen_vid",
      index: undefined,
    });
    expect(findBlock(result, "image")).toBeUndefined();
    expect(textOf(result)).toMatch(/Deepy app/);
    expect(textOf(result)).toMatch(/video/i);
  });

  it("returns a note (not inline) for over-cap results and never the key", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([1, 2, 3, 4, 5, 6]), "image/png")
    );
    const result = await makeGetResultHandler(
      makeToolContext(fetchImpl, TEST_CONFIG, { maxInlineResultBytes: 2 })
    )({ publicId: "gen_big", index: undefined });
    expect(findBlock(result, "image")).toBeUndefined();
    expect(textOf(result)).toMatch(/too large|Deepy app/i);
    expect(serializeResult(result)).not.toContain(TEST_CONFIG.apiKey);
  });

  it("surfaces a backend error from the result fetch", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(404, { code: "MODEL_NOT_FOUND", message: "no such result" })
    );
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "nope",
      index: undefined,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("MODEL_NOT_FOUND");
  });

  it("inlines an allowlisted image/jpeg", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      mediaResponse(Uint8Array.from([1, 2, 3]), "image/jpeg")
    );
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "g",
      index: undefined,
    });
    expect(findBlock(result, "image")?.mimeType).toBe("image/jpeg");
  });
});

// (2 / 4a) content-type allowlist: unexpected / non-media types fall back to a note.
describe("deepy_get_result — content-type allowlist", () => {
  const unexpected: Array<[string]> = [
    ["application/pdf"],
    ["text/html"],
    ["application/octet-stream"],
    ["image/svg+xml"], // not on the raster allowlist
  ];

  it.each(unexpected)(
    "does not inline unexpected type %s (returns a note)",
    async (contentType) => {
      const { fetchImpl } = makeMockFetch(() =>
        mediaResponse(Uint8Array.from([1, 2, 3, 4]), contentType)
      );
      const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
        publicId: "g",
        index: undefined,
      });
      expect(findBlock(result, "image")).toBeUndefined();
      expect(findBlock(result, "audio")).toBeUndefined();
      expect(textOf(result)).toMatch(/can't be previewed|Deepy app/i);
    }
  );
});

// (4c) key never appears in any deepy_get_result output — error or media path.
describe("deepy_get_result — key never leaks (4c)", () => {
  it("redacts the key from a results-endpoint error message", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(500, { code: "INTERNAL_ERROR", message: `boom for ${TEST_CONFIG.apiKey}` })
    );
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "g",
      index: undefined,
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("INTERNAL_ERROR");
    expect(serializeResult(result)).not.toContain(TEST_CONFIG.apiKey);
  });

  it("never exposes the key even if the media bytes contain it", async () => {
    const bytes = new TextEncoder().encode(`prefix ${TEST_CONFIG.apiKey} suffix`);
    const { fetchImpl } = makeMockFetch(() => mediaResponse(bytes, "image/png"));
    const result = await makeGetResultHandler(makeToolContext(fetchImpl))({
      publicId: "g",
      index: undefined,
    });
    // Inlined as base64 — the plaintext key (with underscores) can't appear.
    expect(serializeResult(result)).not.toContain(TEST_CONFIG.apiKey);
  });
});

// Missing coverage: get_generation status hint branches.
describe("deepy_get_generation status hints", () => {
  it("hints to fetch the result when COMPLETED", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "COMPLETED", results: [{}] })
    );
    const result = await makeGetGenerationHandler(makeToolContext(fetchImpl))({ publicId: "g" });
    expect(textOf(result)).toContain("COMPLETED");
    expect(textOf(result)).toContain("deepy_get_result");
  });

  it("hints not to auto-retry when FAILED", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "FAILED", errorCode: "X", errorMessage: "boom" })
    );
    const result = await makeGetGenerationHandler(makeToolContext(fetchImpl))({ publicId: "g" });
    expect(textOf(result)).toContain("FAILED");
    expect(textOf(result)).toMatch(/auto-retry/i);
  });

  it("hints to keep polling while in progress", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, { publicId: "g", status: "PROCESSING" })
    );
    const result = await makeGetGenerationHandler(makeToolContext(fetchImpl))({ publicId: "g" });
    expect(textOf(result)).toMatch(/in progress|poll again/i);
  });
});

// Missing coverage: get_model slash-containing name encoding.
describe("deepy_get_model path encoding", () => {
  it("preserves slashes in a multi-segment model name", async () => {
    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, { modelName: "bytedance/seedance-2.0/text-to-video" })
    );
    await makeGetModelHandler(makeToolContext(fetchImpl))({
      modelName: "bytedance/seedance-2.0/text-to-video",
    });
    expect(calls[0]?.url).toBe(
      "https://anal.plus/api/v1/public/models/bytedance/seedance-2.0/text-to-video"
    );
  });

  it("encodes special characters within a segment while keeping slashes", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(200, { modelName: "x" }));
    await makeGetModelHandler(makeToolContext(fetchImpl))({ modelName: "a b/c d" });
    expect(calls[0]?.url).toBe("https://anal.plus/api/v1/public/models/a%20b/c%20d");
  });
});

describe("happy paths", () => {
  it("deepy_list_models forwards filters and returns the catalog", async () => {
    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, [{ modelName: "bytedance/seedream-v4.5" }])
    );
    const result = await makeListModelsHandler(makeToolContext(fetchImpl))({
      type: "TEXT_TO_IMAGE",
      family: undefined,
      group: undefined,
    });
    expect(result.isError).toBeFalsy();
    expect(calls[0]?.url).toContain("type=TEXT_TO_IMAGE");
    expect(textOf(result)).toContain("seedream");
  });

  it("deepy_improve_prompt returns the improved prompt", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, { data: { prompt: "a cinematic serene mountain lake at dawn" } })
    );
    const result = await makeImprovePromptHandler(makeToolContext(fetchImpl))({
      prompt: "lake",
      modality: "image",
      style: undefined,
    });
    expect(textOf(result)).toContain("cinematic serene mountain lake");
  });
});
