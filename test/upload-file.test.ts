import { mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DeepyApiClient } from "../src/http/client.js";
import type { FetchLike } from "../src/http/client.js";
import { MAX_UPLOAD_BYTES, makeUploadFileHandler } from "../src/tools/upload-file.js";
import { TEST_CONFIG, jsonResponse, makeMockFetch, makeToolContext, textOf } from "./helpers.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("DeepyApiClient — uploadFile", () => {
  it("posts multipart bytes with authorization and no manual Content-Type boundary", async () => {
    const fetchImpl = (async (_input: unknown, init?: RequestInit): Promise<Response> => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${TEST_CONFIG.apiKey}`);
      expect(new Headers(init?.headers).has("content-type")).toBe(false);
      expect(init?.body).toBeInstanceOf(FormData);

      const part = (init?.body as FormData).get("file");
      expect(part).toBeInstanceOf(Blob);
      const file = part as Blob & { name: string };
      expect(file.name).toBe("reference.png");
      expect(file.type).toBe("image/png");
      expect(Buffer.from(await file.arrayBuffer())).toEqual(Buffer.from([1, 2, 3]));
      return jsonResponse(200, {
        fileId: "file-1",
        mediaType: "IMAGE",
        sizeBytes: 3,
        contentType: "image/png",
        expiresAt: "2026-07-25T00:00:00Z",
      });
    }) as unknown as FetchLike;

    const response = await new DeepyApiClient(TEST_CONFIG, { fetchImpl }).uploadFile({
      bytes: Uint8Array.from([1, 2, 3]),
      filename: "reference.png",
      contentType: "image/png",
    });

    expect(response.fileId).toBe("file-1");
  });
});

describe("deepy_upload_file", () => {
  it("reads an attached local path and returns the backend fileId", async () => {
    const directory = await makeTempDirectory();
    const filePath = join(directory, "photo.png");
    await writeFile(filePath, Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));

    const { fetchImpl, calls } = makeMockFetch(() =>
      jsonResponse(200, {
        fileId: "ref-123",
        mediaType: "IMAGE",
        sizeBytes: 4,
        contentType: "image/png",
        expiresAt: "2026-07-25T00:00:00Z",
      })
    );
    const result = await makeUploadFileHandler(makeToolContext(fetchImpl))({
      filePath,
      base64: undefined,
      filename: undefined,
      mimeType: undefined,
    });

    expect(result.isError).not.toBe(true);
    expect(textOf(result)).toContain("ref-123");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${TEST_CONFIG.baseUrl}/api/v1/public/files`);
  });

  it("rejects a file over 50 MiB before making an HTTP call", async () => {
    const directory = await makeTempDirectory();
    const filePath = join(directory, "large.mp4");
    await writeFile(filePath, "");
    await truncate(filePath, MAX_UPLOAD_BYTES + 1);

    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(500, {}));
    const result = await makeUploadFileHandler(makeToolContext(fetchImpl))({
      filePath,
      base64: undefined,
      filename: undefined,
      mimeType: undefined,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("FILE_TOO_LARGE");
    expect(calls).toHaveLength(0);
  });

  it("requires exactly one input source and makes no HTTP call", async () => {
    const { fetchImpl, calls } = makeMockFetch(() => jsonResponse(500, {}));
    const result = await makeUploadFileHandler(makeToolContext(fetchImpl))({
      filePath: undefined,
      base64: undefined,
      filename: undefined,
      mimeType: undefined,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("exactly one source");
    expect(calls).toHaveLength(0);
  });

  it("supports a base64 fallback with filename MIME inference", async () => {
    const { fetchImpl } = makeMockFetch(() =>
      jsonResponse(200, {
        fileId: "video-ref",
        mediaType: "VIDEO",
        sizeBytes: 3,
        contentType: "video/mp4",
        expiresAt: "2026-07-25T00:00:00Z",
      })
    );
    const result = await makeUploadFileHandler(makeToolContext(fetchImpl))({
      filePath: undefined,
      base64: Buffer.from([1, 2, 3]).toString("base64"),
      filename: "clip.mp4",
      mimeType: undefined,
    });

    expect(result.isError).not.toBe(true);
    expect(textOf(result)).toContain("video-ref");
  });
});

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "deepy-mcp-upload-"));
  tempDirectories.push(directory);
  return directory;
}
