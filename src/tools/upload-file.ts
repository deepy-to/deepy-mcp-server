import { open, type FileHandle } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { errorResult, formatJson, runTool, textResult } from "./runtime.js";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/x-m4a",
};

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export const uploadFileInputSchema = {
  filePath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Absolute local path to an image, video, or audio attachment. Preferred for files from the agent window."
    ),
  base64: z
    .string()
    .min(1)
    .optional()
    .describe("Base64 file bytes fallback. Do not use for large files; prefer filePath."),
  filename: z
    .string()
    .min(1)
    .optional()
    .describe("Required with base64; ignored for filePath except for MIME inference fallback."),
  mimeType: z
    .string()
    .min(1)
    .optional()
    .describe("Optional media MIME type. Inferred from the filename extension when omitted."),
};

interface UploadFileArgs {
  filePath: string | undefined;
  base64: string | undefined;
  filename: string | undefined;
  mimeType: string | undefined;
}

interface PreparedUpload {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

export function makeUploadFileHandler(ctx: ToolContext) {
  return (args: UploadFileArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const hasPath = args.filePath !== undefined;
      const hasBase64 = args.base64 !== undefined;
      if (hasPath === hasBase64) {
        return errorResult(
          "[INVALID_INPUT] Provide exactly one source: filePath or base64 (with filename)."
        );
      }

      const upload = hasPath
        ? await preparePathUpload(args.filePath as string, args.mimeType)
        : prepareBase64Upload(args.base64 as string, args.filename, args.mimeType);

      if ("error" in upload) return errorResult(upload.error);

      const response = await ctx.client.uploadFile(upload);
      return textResult(
        formatJson(response) +
          `\n\nUpload complete. Use referenceFiles: ["${response.fileId}"] in both ` +
          "deepy_estimate_generation and deepy_create_generation."
      );
    });
}

export function registerUploadFile(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_upload_file",
    {
      title: "Upload a generation reference",
      description:
        "Upload an image, video, or audio attachment (up to 50 MiB) to Deepy and return its fileId. " +
        "For files attached directly to the agent window, pass their absolute local path as filePath. " +
        "Call this before estimate/create and pass the returned id in referenceFiles.",
      inputSchema: uploadFileInputSchema,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    makeUploadFileHandler(ctx)
  );
}

async function preparePathUpload(
  filePath: string,
  requestedMimeType: string | undefined
): Promise<PreparedUpload | { error: string }> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, "r");
    const stat = await handle.stat();
    if (!stat.isFile()) {
      return { error: "[INVALID_INPUT] filePath must point to a regular file." };
    }
    if (stat.size > MAX_UPLOAD_BYTES) {
      return { error: tooLargeMessage(stat.size) };
    }

    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return { error: tooLargeMessage(bytes.byteLength) };
    }

    const filename = basename(filePath);
    const contentType = resolveMimeType(requestedMimeType, filename);
    if ("error" in contentType) return contentType;
    return { bytes, filename, contentType: contentType.value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `[FILE_READ_ERROR] Could not read the attachment: ${message}` };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function prepareBase64Upload(
  encoded: string,
  filename: string | undefined,
  requestedMimeType: string | undefined
): PreparedUpload | { error: string } {
  if (!filename) {
    return { error: "[INVALID_INPUT] filename is required when base64 is used." };
  }
  if (encoded.length > MAX_BASE64_CHARS || !isStrictBase64(encoded)) {
    return {
      error:
        "[INVALID_INPUT] base64 is malformed or exceeds the 50 MiB decoded limit. " +
        "Use filePath for large attachments.",
    };
  }

  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { error: tooLargeMessage(bytes.byteLength) };
  }

  const safeFilename = basename(filename);
  const contentType = resolveMimeType(requestedMimeType, safeFilename);
  if ("error" in contentType) return contentType;
  return { bytes, filename: safeFilename, contentType: contentType.value };
}

function resolveMimeType(
  requested: string | undefined,
  filename: string
): { value: string } | { error: string } {
  const value = (requested ?? MIME_BY_EXTENSION[extname(filename).toLowerCase()])?.toLowerCase();
  if (!value || !ALLOWED_MIME_TYPES.has(value)) {
    return {
      error:
        `[UNSUPPORTED_MEDIA_TYPE] Cannot determine a supported MIME type for "${filename}". ` +
        "Supported: JPEG, PNG, WebP, MP4, MOV, WebM, MP3, WAV, M4A.",
    };
  }
  return { value };
}

function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function tooLargeMessage(sizeBytes: number): string {
  return (
    `[FILE_TOO_LARGE] Attachment is ${sizeBytes} bytes; the MCP upload limit is ` +
    `${MAX_UPLOAD_BYTES} bytes (50 MiB).`
  );
}
