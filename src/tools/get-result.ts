import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { audioResult, imageResult, runTool, textResult } from "./runtime.js";

export const getResultInputSchema = {
  publicId: z.string().min(1).describe("The publicId of a COMPLETED generation."),
  index: z.number().int().min(0).optional().describe("Result index (0-based). Defaults to 0."),
};

interface GetResultArgs {
  publicId: string;
  index: number | undefined;
}

// Only inline content types we expect from Deepy generations. An unexpected
// (attacker-chosen) content type falls back to the file/text branch instead of
// being inlined as image/audio — defense in depth for the caller's client.
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const INLINE_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
]);

// Max bytes to embed inline (base64) in the tool result. MCP clients (Cursor,
// Claude) truncate/break on large tool outputs, so a multi-MB base64 image
// arrives corrupted. Above this we DON'T inline — we save the full-resolution
// file locally (the server runs on the user's machine via npx) and return its
// path so the image reliably reaches the user. Small images still inline so
// they render directly in-chat.
const INLINE_MAX_BYTES = 160 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};

export function makeGetResultHandler(ctx: ToolContext) {
  return (args: GetResultArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const index = args.index ?? 0;
      // The SERVER fetches the bytes with its API key — the caller never needs
      // (or sees) the key, and no un-authenticatable URL is handed back.
      const media = await ctx.client.getResultMedia(args.publicId, index);

      if (!media.inline) {
        const size = media.sizeBytes !== undefined ? ` (~${humanBytes(media.sizeBytes)})` : "";
        const why =
          media.reason === "video"
            ? "Video results are not inlined here"
            : "This result is too large to inline";
        return textResult(
          `${why}. Generation ${args.publicId} result #${index} is ${media.contentType}${size}. ` +
            "Open the generation in the Deepy app to view or download it."
        );
      }

      const bytes = Buffer.from(media.base64, "base64");
      const isImage = INLINE_IMAGE_TYPES.has(media.contentType);
      const isAudio = INLINE_AUDIO_TYPES.has(media.contentType);

      // Save the full-resolution result to a local temp file (best-effort). The
      // MCP server runs on the user's machine (npx/node), so a local path is a
      // reliable delivery channel regardless of the client's inline-size limit.
      const ext = EXT_BY_TYPE[media.contentType] ?? "bin";
      const filePath = await saveTempFile(
        bytes,
        `deepy-${sanitize(args.publicId)}-${index}.${ext}`
      );
      const savedLine = filePath
        ? `Full-resolution result saved to: ${filePath}\n` +
          "Show it to the user by embedding this local file path as an image in your reply."
        : "";

      const sizeHuman = humanBytes(bytes.length);

      // Small image/audio → inline so it renders directly in-chat (plus the saved path).
      if ((isImage || isAudio) && bytes.length <= INLINE_MAX_BYTES) {
        const caption =
          `Result for generation ${args.publicId} (#${index}) — ${media.contentType}, ~${sizeHuman}.` +
          (savedLine ? `\n${savedLine}` : "");
        return isImage
          ? imageResult(media.base64, media.contentType, caption)
          : audioResult(media.base64, media.contentType, caption);
      }

      // Large image/audio → DON'T inline (a multi-MB base64 arrives broken in the
      // client). Deliver via the saved file path instead.
      if (isImage || isAudio) {
        return textResult(
          `Result for generation ${args.publicId} (#${index}) is ${media.contentType}, ~${sizeHuman} — ` +
            "too large to embed inline reliably.\n" +
            (savedLine || "Open the generation in the Deepy app to view or download it.")
        );
      }

      // Inlineable size but not an expected image/audio type — don't inline an
      // attacker-chosen content type; hand back the saved file / app pointer.
      return textResult(
        `Generation ${args.publicId} result #${index} is ${media.contentType}, which can't be ` +
          "previewed inline here.\n" +
          (savedLine || "Open it in the Deepy app.")
      );
    });
}

export function registerGetResult(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_get_result",
    {
      title: "Get a generation result",
      description:
        "Fetch a COMPLETED generation's result media. The server fetches the bytes with its own API key, " +
        "saves the full-resolution file locally and returns its path, and inlines small images/audio (base64) " +
        "so they render in-chat. Large images are delivered via the saved file path (a multi-MB base64 arrives " +
        "broken in MCP clients). Videos/oversized results point to the Deepy app. Never exposes the API key or a raw URL.",
      inputSchema: getResultInputSchema,
    },
    makeGetResultHandler(ctx)
  );
}

/** Write bytes to a uniquely-named file in the OS temp dir. Best-effort: null on failure. */
async function saveTempFile(bytes: Buffer, filename: string): Promise<string | undefined> {
  try {
    const path = join(tmpdir(), filename);
    await writeFile(path, bytes);
    return path;
  } catch {
    return undefined;
  }
}

/** Keep only filename-safe chars (publicId is a UUID; defensive against odd ids). */
function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
