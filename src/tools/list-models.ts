import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { formatJson, runTool, textResult } from "./runtime.js";
import type { ModelSummaryResponse } from "../types.js";

export const listModelsInputSchema = {
  type: z
    .string()
    .optional()
    .describe("Optional generation-type filter, e.g. TEXT_TO_IMAGE, TEXT_TO_VIDEO, TEXT_TO_AUDIO."),
  family: z.string().optional().describe("Optional model family filter."),
  group: z.string().optional().describe("Optional model group filter."),
};

interface ListModelsArgs {
  type: string | undefined;
  family: string | undefined;
  group: string | undefined;
}

export function makeListModelsHandler(ctx: ToolContext) {
  return (args: ListModelsArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const models = await ctx.client.get<ModelSummaryResponse[]>("/api/v1/public/models", {
        query: { type: args.type, family: args.family, group: args.group },
      });
      const count = Array.isArray(models) ? models.length : 0;
      return textResult(formatJson({ count, models }));
    });
}

export function registerListModels(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_list_models",
    {
      title: "List Deepy models",
      description:
        "List the AI models available to your Deepy API key (only opened/available models are returned). " +
        "Optionally filter by generation type, family, or group. Use this before estimating or creating a generation.",
      inputSchema: listModelsInputSchema,
    },
    makeListModelsHandler(ctx)
  );
}
