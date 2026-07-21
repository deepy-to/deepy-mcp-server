import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { errorResult, formatJson, runTool, textResult } from "./runtime.js";
import { buildGenerationBody } from "../generation-body.js";
import { idempotencyKeyForBody, normalizeIdempotencyKey } from "../idempotency.js";
import type { GenerationResponse } from "../types.js";

export const createGenerationInputSchema = {
  modelName: z.string().min(1).describe("Model name (must match the estimate)."),
  prompt: z.string().describe("Prompt — must be byte-identical to the estimate (quote == charge)."),
  parameters: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Model parameters — must be byte-identical to the estimate. Defaults to {}."),
  referenceFiles: z
    .array(z.string())
    .optional()
    .describe("Reference file ids — must match the estimate. Defaults to []."),
  confirmed: z
    .boolean()
    .describe(
      "MUST be true. Set to true ONLY after the user has seen the estimate and explicitly approved the charge."
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      "Optional X-Idempotency-Key. If omitted, a stable key is derived from the request body so " +
        "retries of the same request are charged once. If you supply an explicit key, not reusing " +
        "it with a different body is your responsibility."
    ),
};

interface CreateGenerationArgs {
  modelName: string;
  prompt: string;
  parameters: Record<string, unknown> | undefined;
  referenceFiles: string[] | undefined;
  confirmed: boolean;
  idempotencyKey: string | undefined;
}

const CONFIRM_REFUSAL =
  "Refusing to create a PAID generation: `confirmed` is not true. " +
  "First call deepy_estimate_generation, show the user the token cost and resulting balance, " +
  "obtain explicit user approval, then call deepy_create_generation again with confirmed=true. " +
  "No request was sent to the backend and nothing was charged.";

export function makeCreateGenerationHandler(ctx: ToolContext) {
  return (args: CreateGenerationArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      // Client-side confirmation gate. The backend has no `confirmed` field —
      // this refusal is the whole point of the tool. No HTTP call is made.
      if (args.confirmed !== true) {
        return errorResult(CONFIRM_REFUSAL);
      }
      const body = buildGenerationBody(args);
      const idempotencyKey =
        normalizeIdempotencyKey(args.idempotencyKey) ?? idempotencyKeyForBody(body);
      const generation = await ctx.client.post<GenerationResponse>("/api/v1/public/generations", {
        body,
        idempotencyKey,
      });
      return textResult(
        formatJson(generation) +
          `\n\nX-Idempotency-Key used: ${idempotencyKey}` +
          `\nPoll status with deepy_get_generation (publicId="${generation.publicId}"). ` +
          "When status=COMPLETED, fetch media with deepy_get_result. " +
          "Do NOT auto-retry a paid create on error (esp. IDEMPOTENCY_CONFLICT)."
      );
    });
}

export function registerCreateGeneration(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_create_generation",
    {
      title: "Create a generation (paid)",
      description:
        "Start a PAID generation. Requires confirmed=true — the tool refuses otherwise and contacts no backend. " +
        "Params must be byte-identical to the estimate (quote == charge). An X-Idempotency-Key is auto-generated " +
        "to prevent double-charging.",
      inputSchema: createGenerationInputSchema,
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    makeCreateGenerationHandler(ctx)
  );
}
