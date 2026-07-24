import { mkdir, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { audioResult, imageResult, runTool, textResult } from "./runtime.js";
export const getResultInputSchema = {
    publicId: z.string().min(1).describe("The publicId of a COMPLETED generation."),
    index: z.number().int().min(0).optional().describe("Result index (0-based). Defaults to 0."),
};
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
// path so the media reliably reaches the user. Small images still inline so
// they render directly in-chat. Videos are NEVER inlined.
const INLINE_MAX_BYTES = 160 * 1024;
const EXT_BY_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};
export function makeGetResultHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const index = args.index ?? 0;
        // The SERVER fetches the bytes with its API key — the caller never needs
        // (or sees) the key, and no un-authenticatable URL is handed back.
        const media = await ctx.client.getResultMedia(args.publicId, index);
        // Non-inline branch: video or oversized media. Prefer local file delivery
        // whenever the client returned downloaded bytes.
        if (!media.inline) {
            if (media.base64) {
                const bytes = Buffer.from(media.base64, "base64");
                const ext = EXT_BY_TYPE[media.contentType] ?? guessExt(media.contentType);
                const filePath = await saveLocalFile(bytes, `deepy-${sanitize(args.publicId)}-${index}.${ext}`);
                const sizeHuman = humanBytes(bytes.length);
                if (filePath) {
                    const kind = media.reason === "video" ? "Video" : "Result";
                    return textResult(`${kind} for generation ${args.publicId} (#${index}) is ${media.contentType}, ~${sizeHuman}.\n` +
                        `Saved to your device: ${filePath}\n` +
                        "Open that local file path for the user (do not send them to the Deepy app).");
                }
            }
            const size = media.sizeBytes !== undefined ? ` (~${humanBytes(media.sizeBytes)})` : "";
            const why = media.reason === "video"
                ? "Video could not be saved locally"
                : "This result is too large to download locally";
            return textResult(`${why}. Generation ${args.publicId} result #${index} is ${media.contentType}${size}. ` +
                "Open the generation in the Deepy app to view or download it.");
        }
        const bytes = Buffer.from(media.base64, "base64");
        const isImage = INLINE_IMAGE_TYPES.has(media.contentType);
        const isAudio = INLINE_AUDIO_TYPES.has(media.contentType);
        // Save the full-resolution result to a local file (best-effort). The
        // MCP server runs on the user's machine (npx/node), so a local path is a
        // reliable delivery channel regardless of the client's inline-size limit.
        const ext = EXT_BY_TYPE[media.contentType] ?? "bin";
        const filePath = await saveLocalFile(bytes, `deepy-${sanitize(args.publicId)}-${index}.${ext}`);
        const savedLine = filePath
            ? `Full-resolution result saved to: ${filePath}\n` +
                (isImage
                    ? "Show it to the user by embedding this local file path as an image in your reply."
                    : "Open that local file path for the user.")
            : "";
        const sizeHuman = humanBytes(bytes.length);
        // Small image/audio → inline so it renders directly in-chat (plus the saved path).
        if ((isImage || isAudio) && bytes.length <= INLINE_MAX_BYTES) {
            const caption = `Result for generation ${args.publicId} (#${index}) — ${media.contentType}, ~${sizeHuman}.` +
                (savedLine ? `\n${savedLine}` : "");
            return isImage
                ? imageResult(media.base64, media.contentType, caption)
                : audioResult(media.base64, media.contentType, caption);
        }
        // Large image/audio → DON'T inline (a multi-MB base64 arrives broken in the
        // client). Deliver via the saved file path instead.
        if (isImage || isAudio) {
            return textResult(`Result for generation ${args.publicId} (#${index}) is ${media.contentType}, ~${sizeHuman} — ` +
                "too large to embed inline reliably.\n" +
                (savedLine || "Open the generation in the Deepy app to view or download it."));
        }
        // Inlineable size but not an expected image/audio type — don't inline an
        // attacker-chosen content type; hand back the saved file / app pointer.
        return textResult(`Generation ${args.publicId} result #${index} is ${media.contentType}, which can't be ` +
            "previewed inline here.\n" +
            (savedLine || "Open it in the Deepy app."));
    });
}
export function registerGetResult(server, ctx) {
    server.registerTool("deepy_get_result", {
        title: "Get a generation result",
        description: "Fetch a COMPLETED generation's result media. The server fetches the bytes with its own API key, " +
            "saves the full-resolution file locally on the user's device and returns its path, and inlines small " +
            "images/audio (base64) so they render in-chat. Videos and large media are delivered via the saved " +
            "local file path (never inlined as base64). Never exposes the API key or a raw URL.",
        inputSchema: getResultInputSchema,
    }, makeGetResultHandler(ctx));
}
/**
 * Prefer ~/Downloads when writable so the user finds the file on their device;
 * fall back to the OS temp dir.
 */
async function saveLocalFile(bytes, filename) {
    const candidates = [join(homedir(), "Downloads"), tmpdir()];
    for (const dir of candidates) {
        try {
            await mkdir(dir, { recursive: true });
            const path = join(dir, filename);
            await writeFile(path, bytes);
            return path;
        }
        catch {
            // try the next candidate
        }
    }
    return undefined;
}
function guessExt(contentType) {
    if (contentType.startsWith("video/"))
        return "mp4";
    if (contentType.startsWith("audio/"))
        return "bin";
    if (contentType.startsWith("image/"))
        return "bin";
    return "bin";
}
/** Keep only filename-safe chars (publicId is a UUID; defensive against odd ids). */
function sanitize(value) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
function humanBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=get-result.js.map