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
// (attacker-chosen) content type falls back to the text-note branch instead of
// being inlined as image/audio — defense in depth for the caller's client.
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const INLINE_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
]);

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
      const caption =
        `Result for generation ${args.publicId} (#${index}) — ${media.contentType}, ` +
        `~${humanBytes(media.sizeBytes)}.`;
      if (INLINE_IMAGE_TYPES.has(media.contentType)) {
        return imageResult(media.base64, media.contentType, caption);
      }
      if (INLINE_AUDIO_TYPES.has(media.contentType)) {
        return audioResult(media.base64, media.contentType, caption);
      }
      // Inlineable size but not an expected image/audio type — don't inline
      // an attacker-chosen content type; point the caller to the app instead.
      return textResult(
        `Generation ${args.publicId} result #${index} is ${media.contentType}, which can't be ` +
          "previewed inline here. Open it in the Deepy app."
      );
    });
}

export function registerGetResult(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_get_result",
    {
      title: "Get a generation result",
      description:
        "Fetch a COMPLETED generation's result media. The server fetches the bytes with its own API key and returns " +
        "images/audio inline (base64). Videos and large files are not inlined — the response explains how to view them " +
        "in the Deepy app. Never exposes the API key or a raw URL.",
      inputSchema: getResultInputSchema,
    },
    makeGetResultHandler(ctx)
  );
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
